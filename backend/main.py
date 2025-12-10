from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from datetime import datetime, date, timedelta
from fastapi.middleware.cors import CORSMiddleware
import json
import os
from typing import Optional, List, Dict, Any
from enum import Enum
import uvicorn

app = FastAPI()

DATA_FILE = "tasks_data.json"


def load_data():
    try:
        if os.path.exists(DATA_FILE):
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                if not content:
                    return {"tasks": [], "categories": []}
                
                data = json.loads(content)
                if "tasks" not in data:
                    data["tasks"] = []
                if "categories" not in data:
                    data["categories"] = []
                return data
        else:
            return {"tasks": [], "categories": []}
    except json.JSONDecodeError:
        if os.path.exists(DATA_FILE):
            backup_name = f"{DATA_FILE}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            os.rename(DATA_FILE, backup_name)
        return {"tasks": [], "categories": []}
    except Exception:
        return {"tasks": [], "categories": []}

def save_data(data):
    try:
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception:
        pass

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://TimurKov1.github.io",  # Ваш GitHub Pages
        "https://*.pythonanywhere.com"     # Для отладки
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RepeatInterval(str, Enum):
    NONE = "none"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"

class TaskCreate(BaseModel):
    title: str
    description: str = ""
    category_id: Optional[int] = None
    priority: str = "medium"
    estimated_time: int = 0
    date: Optional[str] = None
    time: Optional[str] = None  # Новое поле: время в формате "HH:MM"
    repeat_interval: RepeatInterval = RepeatInterval.NONE
    repeat_days: Optional[str] = None
    repeat_until: Optional[str] = None

class TaskUpdate(BaseModel):
    title: str
    description: str = ""
    category_id: Optional[int] = None
    priority: str = "medium"
    estimated_time: int = 0
    repeat_interval: RepeatInterval = RepeatInterval.NONE
    repeat_days: Optional[str] = None
    repeat_until: Optional[str] = None

class CategoryCreate(BaseModel):
    name: str
    color: str = "#3B82F6"
    icon: str = "📁"

class TasksResponse(BaseModel):
    today_active: List[Dict[str, Any]]
    today_completed: List[Dict[str, Any]]
    other_days: List[Dict[str, Any]]

class TaskDateUpdate(BaseModel):
    date: str
    time: Optional[str] = None

@app.put("/tasks/{task_id}/move")
def move_task_to_date(task_id: int, date_update: TaskDateUpdate):
    data = load_data()
    
    task = next((t for t in data["tasks"] if t["id"] == task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Обновляем дату задачи
    try:
        new_date = datetime.fromisoformat(date_update.date).date() + timedelta(days=2)
        print(new_date)
        task["date"] = new_date.isoformat()
        
        # Обновляем время если указано
        if date_update.time:
            task["time"] = date_update.time
            
        # Если задача сгенерирована из шаблона, помечаем как исключение
        if task.get("original_task_id") and not task.get("is_exception"):
            task["is_exception"] = True
            task["repeat_interval"] = "none"
            task["repeat_days"] = None
            task["repeat_until"] = None
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {str(e)}")
    
    save_data(data)
    return task

@app.post("/tasks/")
def create_task(task: TaskCreate):
    data = load_data()
    today = date.today()
    
    category_id = task.category_id
    if category_id is not None:
        try:
            category_id = int(category_id)
        except (ValueError, TypeError):
            category_id = None
    
    # Определяем дату задачи
    task_date = today
    if task.date:
        try:
            task_date = datetime.fromisoformat(task.date).date()
        except Exception:
            task_date = today
    
    new_task = {
        "id": int(datetime.now().timestamp()),
        "title": task.title,
        "description": task.description,
        "category_id": category_id,
        "priority": task.priority,
        "estimated_time": task.estimated_time,
        "date": task_date.isoformat(),
        "time": task.time,
        "repeat_interval": task.repeat_interval,
        "repeat_days": task.repeat_days,
        "repeat_until": task.repeat_until,
        "completed": False,
        "created_at": today.isoformat(),
        "completed_at": None,
        "original_task_id": None,
        "is_exception": False  # Новое поле
    }
    
    # Проверяем, является ли это исключением для шаблона
    if hasattr(task, 'original_task_id') and task.original_task_id:
        new_task["original_task_id"] = task.original_task_id
        new_task["is_exception"] = True
        new_task["repeat_interval"] = "none"
        new_task["repeat_days"] = None
        new_task["repeat_until"] = None
    
    data["tasks"].append(new_task)
    save_data(data)
    
    return new_task

@app.get("/tasks/", response_model=TasksResponse)
def get_tasks():
    data = load_data()
    today = date.today()
    
    print(f"=== GET /tasks/ called for date: {today} ===")
    
    generated_count = generate_today_tasks_logic(data, today)
    if generated_count > 0:
        save_data(data)
    
    today_active = []
    today_completed = []
    other_days = []
    
    for task in data["tasks"]:
        category = None
        if task.get("category_id") and "categories" in data:
            category = next((cat for cat in data["categories"] if cat["id"] == task["category_id"]), None)
        
        task_with_category = task.copy()
        task_with_category["category"] = category
        
        # Добавляем поле overdue (просрочено)
        task_with_category["overdue"] = is_task_overdue(task, today)
        
        is_completed_today = is_task_completed_today(task, today)
        should_display_today = should_display_task_today(task, today)
        
        if is_completed_today:
            today_completed.append(task_with_category)
        elif should_display_today and not task.get("completed"):
            today_active.append(task_with_category)
        else:
            other_days.append(task_with_category)
    
    # Сортируем активные задачи по времени
    today_active.sort(key=lambda x: (
        x.get("time") if x.get("time") else "99:99",  # Без времени в конец
        x["priority"] != "high",  # Сначала высокий приоритет
        x["id"]
    ))
    
    print(f"Today active: {len(today_active)}, Today completed: {len(today_completed)}")
    
    return TasksResponse(
        today_active=today_active,
        today_completed=today_completed,
        other_days=other_days
    )

def generate_today_tasks_logic(data, today):
    generated_count = 0
    
    task_templates = [task for task in data["tasks"] 
                     if task.get("repeat_interval") and 
                     task.get("repeat_interval") != "none" and 
                     task.get("original_task_id") is None]
    
    for template in task_templates:
        should_generate = should_generate_task_today(template, today)
        is_completed = is_task_completed_today(template, today)
        
        if should_generate and not is_completed:
            task_exists = any(
                t.get("original_task_id") == template["id"] and 
                datetime.fromisoformat(t["created_at"]).date() == today
                for t in data["tasks"]
            )
            
            if not task_exists:
                new_task = create_generated_task(template, today, len(data["tasks"]) + 1)
                data["tasks"].append(new_task)
                generated_count += 1
    
    return generated_count

def create_generated_task(template, task_date, new_id):
    new_task = template.copy()
    new_task["id"] = new_id
    new_task["completed"] = False
    new_task["completed_at"] = None
    new_task["created_at"] = task_date.isoformat()
    new_task["original_task_id"] = template["id"]
    
    new_task["repeat_interval"] = "none"
    new_task["repeat_days"] = None
    new_task["repeat_until"] = None
    
    # Сохраняем время из шаблона
    if "time" in template:
        new_task["time"] = template["time"]
    
    return new_task

def is_task_overdue(task, today):
    """Проверяет, просрочена ли задача"""
    if task.get("completed"):
        return False
    
    # Получаем дату задачи
    task_date_str = task.get("date") or task.get("created_at")
    if not task_date_str:
        return False
    
    try:
        task_date = datetime.fromisoformat(task_date_str).date()
        
        # Для сгенерированных задач из шаблонов
        if task.get("original_task_id") is not None:
            return task_date < today
        
        # Для обычных задач
        return task_date < today
        
    except Exception:
        return False

def is_task_completed_today(task, today):
    """Проверяет, выполнена ли задача сегодня И относится ли она к сегодняшнему дню"""
    if not task.get("completed"):
        return False
    
    completed_at = task.get("completed_at")
    if not completed_at:
        return False
    
    try:
        completed_date = datetime.fromisoformat(completed_at).date()
        
        # Проверяем, выполнена ли задача сегодня
        if completed_date != today:
            return False
        
        # Получаем дату, на которую запланирована задача
        task_date_str = task.get("date") or task.get("created_at")
        if not task_date_str:
            return False
            
        task_date = datetime.fromisoformat(task_date_str).date()
        
        # Задача считается выполненной сегодня, только если она была запланирована на сегодня
        return task_date == today
        
    except Exception as e:
        print(f"Error in is_task_completed_today: {e}")
        return False

@app.put("/tasks/{task_id}/uncomplete")
def uncomplete_task(task_id: int):
    data = load_data()
    today = date.today()
    
    task = next((t for t in data["tasks"] if t["id"] == task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task["completed"] = False
    task["completed_at"] = None
    
    original_task_id = task.get("original_task_id")
    if original_task_id:
        original_task = next((t for t in data["tasks"] if t["id"] == original_task_id), None)
        if original_task and should_display_task_today(original_task, today):
            data["tasks"] = [t for t in data["tasks"] if t["id"] != task_id]
            new_task = create_generated_task(original_task, today, len(data["tasks"]) + 1)
            data["tasks"].append(new_task)
    
    save_data(data)
    return task

@app.put("/tasks/{task_id}")
def update_task(task_id: int, task_update: TaskUpdate):
    data = load_data()
    today = date.today()
    
    task = next((t for t in data["tasks"] if t["id"] == task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    category_id = task_update.category_id
    if category_id is not None:
        try:
            category_id = int(category_id)
        except (ValueError, TypeError):
            category_id = None
    
    task["title"] = task_update.title
    task["description"] = task_update.description
    task["category_id"] = category_id
    task["priority"] = task_update.priority
    task["estimated_time"] = task_update.estimated_time
    task["repeat_interval"] = task_update.repeat_interval
    task["repeat_days"] = task_update.repeat_days
    task["repeat_until"] = task_update.repeat_until
    
    if task.get("original_task_id") is None:
        generated_tasks = [t for t in data["tasks"] if t.get("original_task_id") == task_id]
        
        for generated_task in generated_tasks:
            generated_date = datetime.fromisoformat(generated_task["created_at"]).date()
            
            temp_task = generated_task.copy()
            temp_task["repeat_interval"] = task_update.repeat_interval
            temp_task["repeat_days"] = task_update.repeat_days
            temp_task["repeat_until"] = task_update.repeat_until
            
            should_display = should_task_display_today_after_update(temp_task, generated_date)
            
            if not should_display:
                data["tasks"] = [t for t in data["tasks"] if t["id"] != generated_task["id"]]
    
    save_data(data)
    return task

@app.delete("/tasks/{task_id}")
def delete_task(task_id: int):
    data = load_data()
    
    if task_id:
        data["tasks"] = [t for t in data["tasks"] if t["id"] != task_id and t.get("original_task_id") != task_id]
    
    save_data(data)
    return {"message": "Task deleted"}

@app.get("/stats/")
def get_stats():
    data = load_data()
    today = date.today()
    
    today_tasks = [t for t in data["tasks"] if should_display_task_today(t, today) or is_task_completed_today(t, today)]
    
    completed_today = len([t for t in today_tasks if is_task_completed_today(t, today)])
    total_tasks = len(today_tasks)
    
    high_priority = len([t for t in today_tasks if t["priority"] == "high"])
    medium_priority = len([t for t in today_tasks if t["priority"] == "medium"])
    low_priority = len([t for t in today_tasks if t["priority"] == "low"])
    
    total_time = sum(t.get("estimated_time", 0) for t in today_tasks)
    completed_time = sum(t.get("estimated_time", 0) for t in today_tasks if is_task_completed_today(t, today))
    
    return {
        "total_tasks": total_tasks,
        "completed_tasks": completed_today,
        "completion_rate": (completed_today / total_tasks * 100) if total_tasks > 0 else 0,
        "high_priority": high_priority,
        "medium_priority": medium_priority,
        "low_priority": low_priority,
        "total_time_minutes": total_time,
        "completed_time_minutes": completed_time,
        "time_completion_rate": (completed_time / total_time * 100) if total_time > 0 else 0
    }

@app.get("/health")
def health_check():
    return {"status": "healthy", "message": "Task Tracker Server is running"}

@app.get("/categories/")
def get_categories():
    try:
        data = load_data()
        
        if "categories" not in data or not data["categories"]:
            data["categories"] = [
                {"id": 1, "name": "Работа", "color": "#3B82F6", "icon": "💼"},
                {"id": 2, "name": "Личное", "color": "#10B981", "icon": "🏠"},
                {"id": 3, "name": "Здоровье", "color": "#EF4444", "icon": "💊"},
                {"id": 4, "name": "Обучение", "color": "#8B5CF6", "icon": "📚"},
                {"id": 5, "name": "Отдых", "color": "#F59E0B", "icon": "🎮"},
                {"id": 6, "name": "Спорт", "color": "#470027", "icon": "🏃"}
            ]
            save_data(data)
        
        return data["categories"]
    except Exception:
        return [
            {"id": 1, "name": "Работа", "color": "#3B82F6", "icon": "💼"},
            {"id": 2, "name": "Личное", "color": "#10B981", "icon": "🏠"},
            {"id": 3, "name": "Здоровье", "color": "#EF4444", "icon": "💊"},
            {"id": 4, "name": "Обучение", "color": "#8B5CF6", "icon": "📚"},
            {"id": 5, "name": "Отдых", "color": "#F59E0B", "icon": "🎮"},
            {"id": 6, "name": "Спорт", "color": "#470027", "icon": "🏃"}
        ]

@app.post("/categories/")
def create_category(category: CategoryCreate):
    data = load_data()
    
    if "categories" not in data:
        data["categories"] = []
    
    new_category = {
        "id": len(data["categories"]) + 1,
        "name": category.name,
        "color": category.color,
        "icon": category.icon
    }
    
    data["categories"].append(new_category)
    save_data(data)
    
    return new_category

@app.put("/tasks/{task_id}/complete")
def complete_task_with_repeat(task_id: int):
    data = load_data()
    today = date.today()
    
    task = next((t for t in data["tasks"] if t["id"] == task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task["completed"] = True
    task["completed_at"] = datetime.now().isoformat()
    
    original_task_id = task.get("original_task_id")
    if original_task_id:
        original_task = next((t for t in data["tasks"] if t["id"] == original_task_id), None)
        if original_task and should_create_next_task(original_task, today):
            create_next_repeated_task(data, original_task, today)
    else:
        if task.get("repeat_interval") != "none" and should_create_next_task(task, today):
            create_next_repeated_task(data, task, today)
    
    save_data(data)
    return task

def should_create_next_task(task, current_date):
    if task.get("repeat_interval") == "none":
        return False
    
    if task.get("repeat_until"):
        try:
            repeat_until = datetime.fromisoformat(task["repeat_until"]).date()
            if current_date >= repeat_until:
                return False
        except Exception:
            pass
    
    return True

def create_next_repeated_task(data, original_task, current_date):
    next_date = calculate_next_date(current_date, original_task)
    if not next_date:
        return
    
    task_exists = any(
        t.get("original_task_id") == original_task["id"] and 
        datetime.fromisoformat(t["created_at"]).date() == next_date
        for t in data["tasks"]
    )
    
    if task_exists:
        return
    
    new_task = create_generated_task(original_task, next_date, len(data["tasks"]) + 1)
    data["tasks"].append(new_task)

def calculate_next_date(current_date, task):
    repeat_interval = task.get("repeat_interval")
    
    if repeat_interval == "daily":
        return current_date + timedelta(days=1)
    
    elif repeat_interval == "weekly" and task.get("repeat_days"):
        current_weekday = current_date.weekday()
        repeat_days = []
        try:
            repeat_days = [int(day.strip()) for day in task["repeat_days"].split(",") if day.strip()]
        except (ValueError, AttributeError):
            return None
        
        for day_offset in range(1, 8):
            next_date = current_date + timedelta(days=day_offset)
            if next_date.weekday() in repeat_days:
                return next_date
    
    elif repeat_interval == "monthly":
        next_month = current_date.replace(day=28) + timedelta(days=4)
        return next_month.replace(day=min(current_date.day, [31,29,31,30,31,30,31,31,30,31,30,31][next_month.month-1]))
    
    return None

def should_generate_task_today(task, today):
    try:
        task_created_date = datetime.fromisoformat(task["created_at"]).date()
    except:
        return False
    
    if task.get("repeat_until"):
        try:
            repeat_until = datetime.fromisoformat(task["repeat_until"]).date()
            if today > repeat_until:
                return False
        except Exception:
            pass
    
    if task["repeat_interval"] == "daily":
        return today >= task_created_date
    
    if task["repeat_interval"] == "weekly" and task.get("repeat_days"):
        if today < task_created_date:
            return False
        
        repeat_days = []
        try:
            if isinstance(task["repeat_days"], str):
                repeat_days = [int(day.strip()) for day in task["repeat_days"].split(",") if day.strip()]
            elif isinstance(task["repeat_days"], list):
                repeat_days = [int(day) for day in task["repeat_days"]]
        except (ValueError, AttributeError):
            return False
        
        current_weekday = today.weekday()
        return current_weekday in repeat_days
    
    if task["repeat_interval"] == "monthly":
        if today < task_created_date:
            return False
        return today.day == task_created_date.day
    
    return task_created_date == today

def should_display_task_today(task, today):
    """Проверяет, должна ли задача отображаться сегодня как активная"""
    if is_task_completed_today(task, today):
        return False
    
    # Получаем дату задачи (поле date или created_at как fallback)
    task_date_str = task.get("date") or task.get("created_at")
    if not task_date_str:
        return False
    
    try:
        task_date = datetime.fromisoformat(task_date_str).date()
    except Exception:
        return False
    
    # Для повторяющихся задач (шаблонов)
    if task.get("original_task_id") is None and task.get("repeat_interval") not in [None, "none"]:
        return False
    
    # Для сгенерированных задач из шаблонов
    if task.get("original_task_id") is not None:
        return task_date == today
    
    # Для обычных задач: показываем только если дата задачи - сегодня
    return task_date == today

def should_task_display_today_after_update(task, today):
    if task.get("repeat_interval") in [None, "none"]:
        task_date = datetime.fromisoformat(task["created_at"]).date()
        return task_date == today
    
    return should_generate_task_today(task, today)

@app.get("/calendar/{date_str}")
def get_calendar_tasks(date_str: str):
    data = load_data()
    today = date.today()
    
    try:
        target_date = datetime.fromisoformat(date_str).date()
    except Exception:
        target_date = date.today()
    
    tasks_for_date = []
    
    for task in data["tasks"]:
        # Проверяем, является ли задача исключением
        if task.get("is_exception"):
            # Для исключений используем обычную логику
            task_date_str = task.get("date") or task.get("created_at")
        else:
            # Для обычных задач проверяем дату выполнения
            task_date_str = task.get("date") or task.get("created_at")
        
        if not task_date_str:
            continue
        
        try:
            task_date = datetime.fromisoformat(task_date_str).date()
        except Exception:
            continue
        
        # Проверяем, относится ли задача к этой дате
        if task_date == target_date:
            category = None
            if task.get("category_id") and "categories" in data:
                category = next((cat for cat in data["categories"] if cat["id"] == task["category_id"]), None)
            
            task_with_category = task.copy()
            task_with_category["category"] = category
            task_with_category["overdue"] = task_date < today and not task.get("completed")
            tasks_for_date.append(task_with_category)
    
    tasks_for_date.sort(key=lambda x: (
        x.get("time") if x.get("time") else "99:99",
        x["priority"] != "high",
        x["id"]
    ))
    
    return {"date": date_str, "tasks": tasks_for_date}

def check_task_time_for_notification(task, current_time):
    """Проверяет, нужно ли отправлять уведомление для задачи"""
    if not task.get("time") or task.get("completed"):
        return False
    
    try:
        # Парсим время задачи
        task_time_str = task["time"]
        task_hour, task_minute = map(int, task_time_str.split(":"))
        
        # Получаем текущее время
        current_hour = current_time.hour
        current_minute = current_time.minute
        
        # Вычисляем разницу в минутах
        task_total_minutes = task_hour * 60 + task_minute
        current_total_minutes = current_hour * 60 + current_minute
        
        diff_minutes = task_total_minutes - current_total_minutes
        
        # Уведомляем за 30 минут
        return 28 <= diff_minutes <= 32
        
    except (ValueError, KeyError, AttributeError):
        return False

# Добавьте новый эндпоинт
@app.get("/notifications/check")
def check_notifications():
    """Проверяет задачи для уведомлений"""
    data = load_data()
    now = datetime.now()
    today = now.date()
    
    notifications = []
    
    for task in data["tasks"]:
        # Проверяем только активные задачи на сегодня
        if (should_display_task_today(task, today) and 
            not task.get("completed") and
            check_task_time_for_notification(task, now)):
            
            notifications.append({
                "task_id": task["id"],
                "title": task["title"],
                "time": task.get("time", ""),
                "description": task.get("description", ""),
                "notification_time": now.isoformat()
            })
    
    return {"notifications": notifications}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)