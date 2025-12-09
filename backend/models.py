from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Float, JSON, ForeignKey, Date
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base

class Category(Base):
    __tablename__ = "categories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    color = Column(String, default="#3B82F6")  # Цвет категории
    icon = Column(String, default="📝")  # Иконка
    created_at = Column(DateTime, default=func.now())

class Habit(Base):
    __tablename__ = "habits"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(Text, default="")
    frequency = Column(String, default="daily")  # daily, weekly, monthly
    target_count = Column(Integer, default=1)    # Сколько раз нужно выполнить
    current_streak = Column(Integer, default=0)  # Текущая серия
    longest_streak = Column(Integer, default=0)  # Самая длинная серия
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    color = Column(String, default="#3B82F6")
    icon = Column(String, default="✅")
    goal_type = Column(String, default="boolean")  # boolean или quantitative
    goal_value = Column(Float, default=1.0)        # Целевое значение для количественных
    unit = Column(String, default="")              # Единица измерения
    created_at = Column(DateTime, default=func.now())
    
    # Связи
    category = relationship("Category")

class HabitEntry(Base):
    __tablename__ = "habit_entries"
    
    id = Column(Integer, primary_key=True, index=True)
    habit_id = Column(Integer, ForeignKey("habits.id"), index=True)
    date = Column(Date, index=True)
    completed = Column(Boolean, default=False)
    value = Column(Float, default=0.0)  # Для количественных привычек
    note = Column(Text, default="")
    sentiment_score = Column(Float, default=0.0)
    sentiment_label = Column(String, default="neutral")
    created_at = Column(DateTime, default=func.now())

class Goal(Base):
    __tablename__ = "goals"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(Text, default="")
    target_habits = Column(JSON)  # Список привычек для цели
    target_days = Column(Integer, default=30)  # Количество дней
    start_date = Column(Date)
    end_date = Column(Date)
    progress = Column(Float, default=0.0)  # 0-100%
    completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())