import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { 
  Menu, 
  X, 
  Plus, 
  Calendar, 
  BarChart, 
  Bell, 
  BellOff,
  CheckSquare,
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon
} from 'lucide-react'; // Или используем иконки из другого набора

const API_BASE = 'https://timurkov.pythonanywhere.com'

const getRepeatLabel = (interval, days) => {
  if (!interval || interval === 'none') return ''
  
  switch (interval) {
    case 'daily':
      return 'Ежедневно'
    case 'weekly':
      if (days && days.length > 0) {
        try {
          const dayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
          const dayArray = typeof days === 'string' ? days.split(',') : days;
          const selectedDays = dayArray.map(day => dayLabels[parseInt(day)])
          return `По ${selectedDays.join(',')}`
        } catch (error) {
          return 'Еженедельно'
        }
      }
      return 'Еженедельно'
    case 'monthly':
      return 'Ежемесячно'
    default:
      return 'Повторяется'
  }
}

function App() {
  const [tasks, setTasks] = useState({
    today_active: [],
    today_completed: [],
    templates: []
  })
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDescription, setNewTaskDescription] = useState('')
  const [categories, setCategories] = useState([])
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [selectedPriority, setSelectedPriority] = useState('medium')
  const [estimatedTime, setEstimatedTime] = useState(0)

  // Состояние для создания шаблона
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false)
  const [repeatInterval, setRepeatInterval] = useState('none')
  const [repeatDays, setRepeatDays] = useState([])
  const [repeatUntil, setRepeatUntil] = useState('')
  const [templateStartDate, setTemplateStartDate] = useState(new Date().toISOString().split('T')[0])

  const [refreshCalendar, setRefreshCalendar] = useState(0)
  const [refreshStats, setRefreshStats] = useState(0)
  const [taskDate, setTaskDate] = useState(new Date().toISOString().split('T')[0])
  const [isSpecificDate, setIsSpecificDate] = useState(false)

  const [taskTime, setTaskTime] = useState('')

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [serviceWorkerReady, setServiceWorkerReady] = useState(false);
  const notificationCheckInterval = useRef(null);
  const [notificationsHistory, setNotificationsHistory] = useState([]);
  const swRegistrationRef = useRef(null);
  
  // Мобильные состояния
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState('tasks'); // 'tasks', 'calendar', 'stats'
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  useEffect(() => {
    loadTasks()
    loadCategories()
    // Проверяем предпочтение темы
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
    }
  }, [])

  useEffect(() => {
    initializeNotifications();
    
    return () => {
      if (notificationCheckInterval.current) {
        clearInterval(notificationCheckInterval.current);
      }
    };
  }, []);

  // Применяем тему
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const initializeNotifications = async () => {
    try {
      if (!('Notification' in window)) {
        console.log('❌ Браузер не поддерживает уведомления')
        return
      }
      
      let permission = Notification.permission
      
      if (permission === 'default') {
        permission = await Notification.requestPermission()
      }
      
      if (permission === 'granted') {
        setNotificationsEnabled(true)
        await registerServiceWorker()
        
        setTimeout(() => {
          startNotificationChecking()
        }, 1000)
      }
    } catch (error) {
      console.error('❌ Ошибка инициализации уведомлений:', error)
    }
  }

  const registerServiceWorker = async () => {
    try {
      if (!('serviceWorker' in navigator)) {
        console.log('❌ Service Worker не поддерживается');
        return;
      }
      
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      swRegistrationRef.current = registration;
    
      setServiceWorkerReady(true);
      
      if (registration.active) {
        registration.active.postMessage({
          type: 'INIT',
          apiBase: API_BASE
        });
      }
      
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker) {
          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                if (window.confirm('Доступна новая версия приложения. Обновить?')) {
                  registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
                  window.location.reload();
                }
              }
            }
          };
        }
      };
    } catch (error) {
      console.error('❌ Ошибка регистрации Service Worker:', error);
    }
  };

  const startNotificationChecking = () => {
    if (notificationCheckInterval.current) {
      clearInterval(notificationCheckInterval.current);
    }
    
    notificationCheckInterval.current = setInterval(async () => {
      await checkTasksForNotifications();
    }, 60000);
    
    checkTasksForNotifications();
  };

  const checkTasksForNotifications = async () => {
    try {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTotalMinutes = currentHour * 60 + currentMinute;
      
      const response = await axios.get(`${API_BASE}/tasks/`)
      const { today_active } = response.data;
      
      today_active.forEach(task => {
        if (task.time && !task.completed) {
          try {
            const [taskHour, taskMinute] = task.time.split(':').map(Number);
            const taskTotalMinutes = taskHour * 60 + taskMinute;
            const diffMinutes = taskTotalMinutes - currentTotalMinutes;
            
            if (diffMinutes == 30) {
              sendBrowserNotification(task);
            }
          } catch (error) {
            console.error('Ошибка парсинга времени:', error);
          }
        }
      });
    } catch (error) {
      console.error('Ошибка проверки уведомлений:', error);
    }
  };

  const sendBrowserNotification = (task) => {
    if (Notification.permission !== 'granted') {
      console.log('❌ Уведомления не разрешены системой')
      return
    }
    
    const alreadyNotified = notificationsHistory.some(
      n => n.taskId === task.id && 
      new Date() - new Date(n.sentAt) < 60000
    );
    
    if (alreadyNotified) {
      console.log(`Уведомление уже отправлено для задачи ${task.id}`);
      return;
    }
    
    const notification = new Notification('⏰ Напоминание о задаче', {
      body: `Через 30 минут: "${task.title}"`,
      icon: '/vite.svg',
      tag: `task-reminder-${task.id}`,
      requireInteraction: true,
      silent: false
    });
    
    console.log(`✅ Уведомление отправлено: ${task.title}`);
    
    const notificationRecord = {
      id: Date.now(),
      taskId: task.id,
      taskTitle: task.title,
      taskTime: task.time,
      sentAt: new Date().toISOString()
    };
    
    setNotificationsHistory(prev => [...prev, notificationRecord]);
    
    if (notificationsHistory.length > 50) {
      setNotificationsHistory(prev => prev.slice(-50));
    }
    
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    
    setTimeout(() => {
      notification.close();
    }, 30000);
  };

  const testNotification = () => {
    if (!notificationsEnabled) {
      alert('Пожалуйста, разрешите уведомления в браузере');
      return;
    }
    
    const testTask = {
      id: 'test',
      title: 'Тестовая задача',
      time: '12:00',
      completed: false
    };
    
    sendBrowserNotification(testTask);
    alert('Тестовое уведомление отправлено!');
  };

  const toggleNotifications = async () => {
    if (!('Notification' in window)) {
      alert('Ваш браузер не поддерживает уведомления');
      return;
    }
    
    if (Notification.permission === 'denied') {
      alert('Вы заблокировали уведомления. Разрешите их в настройках браузера.');
      return;
    }
    
    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        await registerServiceWorker();
        startNotificationChecking();
        alert('✅ Уведомления включены!');
      }
    } else {
      setNotificationsEnabled(!notificationsEnabled);
      alert(notificationsEnabled ? '🔕 Уведомления выключены' : '🔔 Уведомления включены');
    }
  };

  const refreshAllData = async () => {
    await loadTasks()
    setRefreshCalendar(prev => prev + 1)
    setRefreshStats(prev => prev + 1)
  }

  const loadTasks = async () => {
    try {
      const response = await axios.get(`${API_BASE}/tasks/`)
      setTasks(response.data)
    } catch (error) {
      console.error('Error loading tasks:', error)
    }
  }

  const loadCategories = async () => {
    try {
      const response = await axios.get(`${API_BASE}/categories/`)
      setCategories(response.data)
    } catch (error) {
      console.error('Error loading categories:', error)
    }
  }

  const createTask = async (e) => {
    e?.preventDefault()
    if (!newTaskTitle.trim()) return
    
    try {
      const taskData = {
        title: newTaskTitle,
        description: newTaskDescription,
        priority: selectedPriority,
        estimated_time: estimatedTime,
        date: isSpecificDate ? taskDate : new Date().toISOString().split('T')[0],
        time: taskTime || null
      }
      
      if (selectedCategoryId) {
        taskData.category_id = parseInt(selectedCategoryId)
      }
      
      await axios.post(`${API_BASE}/tasks/`, taskData)
      
      // Сброс формы
      setNewTaskTitle('')
      setNewTaskDescription('')
      setSelectedCategoryId('')
      setSelectedPriority('medium')
      setEstimatedTime(0)
      setIsSpecificDate(false)
      setTaskDate(new Date().toISOString().split('T')[0])
      setTaskTime('')
      setIsCreatingTask(false)
      
      await loadTasks()
      setRefreshCalendar(prev => prev + 1)
      setRefreshStats(prev => prev + 1)
    } catch (error) {
      console.error('Error creating task:', error)
    }
  }

  const createTemplate = async (e) => {
    e.preventDefault()
    if (!newTaskTitle.trim()) return
    
    try {
      const templateData = {
        title: newTaskTitle,
        description: newTaskDescription,
        priority: selectedPriority,
        estimated_time: estimatedTime,
        repeat_interval: repeatInterval,
        start_date: templateStartDate,
        time: taskTime || null
      }
      
      if (repeatInterval === 'weekly' && repeatDays.length > 0) {
        templateData.repeat_days = repeatDays.join(',')
      }
      
      if (repeatUntil && repeatInterval !== 'none') {
        templateData.repeat_until = repeatUntil
      }
      
      if (selectedCategoryId) {
        templateData.category_id = parseInt(selectedCategoryId)
      }
      
      await axios.post(`${API_BASE}/templates/`, templateData)
      
      // Сброс формы
      setNewTaskTitle('')
      setNewTaskDescription('')
      setSelectedCategoryId('')
      setSelectedPriority('medium')
      setEstimatedTime(0)
      setRepeatInterval('none')
      setRepeatDays([])
      setRepeatUntil('')
      setTemplateStartDate(new Date().toISOString().split('T')[0])
      setIsCreatingTemplate(false)
      setIsCreatingTask(false)
      
      await loadTasks()
      setRefreshCalendar(prev => prev + 1)
      setRefreshStats(prev => prev + 1)
    } catch (error) {
      console.error('Error creating template:', error)
    }
  }

  const completeTask = async (taskId) => {
    try {
      await axios.put(`${API_BASE}/tasks/${taskId}/complete`)
      await loadTasks()
      setRefreshCalendar(prev => prev + 1)
      setRefreshStats(prev => prev + 1)
    } catch (error) {
      console.error('Error completing task:', error)
    }
  }

  const deleteTask = async (taskId) => {
    try {
      await axios.delete(`${API_BASE}/tasks/${taskId}`)
      await loadTasks()
      setRefreshCalendar(prev => prev + 1)
      setRefreshStats(prev => prev + 1)
    } catch (error) {
      console.error('Error deleting task:', error)
    }
  }

  const deleteTemplate = async (templateId) => {
    try {
      await axios.delete(`${API_BASE}/templates/${templateId}`)
      await loadTasks()
      setRefreshCalendar(prev => prev + 1)
      setRefreshStats(prev => prev + 1)
    } catch (error) {
      console.error('Error deleting template:', error)
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'red'
      case 'medium': return 'yellow'
      case 'low': return 'green'
      default: return 'gray'
    }
  }

  const formatTime = (minutes) => {
    if (minutes < 60) return `${minutes}м`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}ч ${mins}м` : `${hours}ч`
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  // Мобильное меню
  const MobileMenu = () => (
    <div className={`fixed inset-0 bg-black bg-opacity-50 z-50 transition-opacity ${isMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className={`absolute left-0 top-0 h-full w-64 bg-white dark:bg-gray-800 shadow-xl transform transition-transform ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 border-b dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold dark:text-white">Меню</h2>
            <button 
              onClick={() => setIsMenuOpen(false)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <X className="w-5 h-5 dark:text-white" />
            </button>
          </div>
        </div>
        
        <div className="p-4 space-y-2">
          <button 
            onClick={() => { setActiveView('tasks'); setIsMenuOpen(false); }}
            className={`w-full text-left p-3 rounded-lg flex items-center gap-3 ${activeView === 'tasks' ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            <CheckSquare className="w-5 h-5" />
            <span>Задачи</span>
          </button>
          
          <button 
            onClick={() => { setActiveView('calendar'); setIsMenuOpen(false); }}
            className={`w-full text-left p-3 rounded-lg flex items-center gap-3 ${activeView === 'calendar' ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            <Calendar className="w-5 h-5" />
            <span>Календарь</span>
          </button>
          
          <button 
            onClick={() => { setActiveView('stats'); setIsMenuOpen(false); }}
            className={`w-full text-left p-3 rounded-lg flex items-center gap-3 ${activeView === 'stats' ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            <BarChart className="w-5 h-5" />
            <span>Статистика</span>
          </button>
          
          <div className="border-t dark:border-gray-700 pt-4">
            <div className="flex items-center justify-between p-3">
              <span className="dark:text-white">Тема</span>
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700"
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
            
            <div className="flex items-center justify-between p-3">
              <span className="dark:text-white">Уведомления</span>
              <button 
                onClick={toggleNotifications}
                className="p-2 rounded-lg"
              >
                {notificationsEnabled ? <Bell className="w-5 h-5 text-green-500" /> : <BellOff className="w-5 h-5 text-gray-500" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Фаб кнопка для создания задач
  const FabButton = () => (
    <button
      onClick={() => setIsCreatingTask(true)}
      className="fixed bottom-6 right-6 bg-blue-500 hover:bg-blue-600 text-white p-4 rounded-full shadow-lg z-40 flex items-center justify-center"
    >
      <Plus className="w-6 h-6" />
    </button>
  );

  // Модальное окно создания задачи
  const CreateTaskModal = () => (
    <div className={`fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 ${isCreatingTask ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className={`bg-white dark:bg-gray-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto transform transition-all ${isCreatingTask ? 'scale-100' : 'scale-95'}`}>
        <div className="p-4 border-b dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold dark:text-white">Новая задача</h2>
            <button 
              onClick={() => setIsCreatingTask(false)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <X className="w-5 h-5 dark:text-white" />
            </button>
          </div>
        </div>
        
        <form onSubmit={createTask} className="p-4 space-y-3">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Название задачи"
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            autoFocus
          />
          
          <textarea
            value={newTaskDescription}
            onChange={(e) => setNewTaskDescription(e.target.value)}
            placeholder="Описание (необязательно)"
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows="2"
          />
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Категория
              </label>
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">Без категории</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Приоритет
              </label>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="low">🟢 Низкий</option>
                <option value="medium">🟡 Средний</option>
                <option value="high">🔴 Высокий</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Время (минуты)
              </label>
              <input
                type="number"
                value={estimatedTime}
                onChange={(e) => setEstimatedTime(parseInt(e.target.value) || 0)}
                min="0"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Время выполнения
              </label>
              <input
                type="time"
                value={taskTime}
                onChange={(e) => setTaskTime(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>
          
          <div className="pt-2">
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isSpecificDate}
                onChange={(e) => setIsSpecificDate(e.target.checked)}
                className="sr-only peer"
              />
              <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                Запланировать
              </span>
            </label>
            
            {isSpecificDate && (
              <div className="mt-2">
                <input
                  type="date"
                  value={taskDate}
                  onChange={(e) => setTaskDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            )}
          </div>
          
          <div className="flex gap-2 pt-4">
            <button 
              type="button"
              onClick={() => setIsCreatingTask(false)}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Отмена
            </button>
            <button 
              type="submit"
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-lg font-semibold"
            >
              Добавить
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <MobileMenu />
      <CreateTaskModal />
      <FabButton />
      
      {/* Мобильный хедер */}
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsMenuOpen(true)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <Menu className="w-6 h-6 dark:text-white" />
              </button>
              <h1 className="text-xl font-bold text-gray-800 dark:text-white">
                📝 Планировщик
              </h1>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={toggleNotifications}
                className={`p-2 rounded-lg ${notificationsEnabled ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
              >
                {notificationsEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
              </button>
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700"
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          {/* Навигация по вкладкам для мобильных */}
          <div className="flex mt-3 border-b dark:border-gray-700">
            <button 
              onClick={() => setActiveView('tasks')}
              className={`flex-1 py-2 text-center font-medium text-sm ${activeView === 'tasks' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500' : 'text-gray-500 dark:text-gray-400'}`}
            >
              Задачи
            </button>
            <button 
              onClick={() => setActiveView('calendar')}
              className={`flex-1 py-2 text-center font-medium text-sm ${activeView === 'calendar' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500' : 'text-gray-500 dark:text-gray-400'}`}
            >
              Календарь
            </button>
            <button 
              onClick={() => setActiveView('stats')}
              className={`flex-1 py-2 text-center font-medium text-sm ${activeView === 'stats' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500' : 'text-gray-500 dark:text-gray-400'}`}
            >
              Статистика
            </button>
          </div>
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto px-4 py-4">
        {/* Контент в зависимости от активной вкладки */}
        <div className={`${activeView === 'tasks' ? 'block' : 'hidden'}`}>
          {/* Сегодняшние задачи */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 mb-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold dark:text-white">📋 Активные задачи</h2>
              <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full text-xs font-semibold">
                {tasks.today_active.length}
              </span>
            </div>
            
            <div className="space-y-2">
              {tasks.today_active.map(task => (
                <MobileTaskCard 
                  key={task.id} 
                  task={task} 
                  categories={categories}
                  onComplete={() => completeTask(task.id)}
                  onDelete={() => deleteTask(task.id)}
                  getPriorityColor={getPriorityColor}
                  formatTime={formatTime}
                />
              ))}
              {tasks.today_active.length === 0 && (
                <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                  <p className="text-sm">Нет активных задач</p>
                  <p className="text-xs mt-1">Нажмите + чтобы добавить</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Выполненные задачи */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 mb-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold dark:text-white">✅ Выполнено</h2>
              <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded-full text-xs font-semibold">
                {tasks.today_completed.length}
              </span>
            </div>
            
            <div className="space-y-2">
              {tasks.today_completed.map(task => (
                <MobileCompletedTaskCard 
                  key={task.id} 
                  task={task} 
                  onDelete={() => deleteTask(task.id)}
                  getPriorityColor={getPriorityColor}
                  formatTime={formatTime}
                />
              ))}
              {tasks.today_completed.length === 0 && (
                <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                  <p className="text-sm">Нет выполненных задач</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className={`${activeView === 'calendar' ? 'block' : 'hidden'}`}>
          <MobileTaskCalendar 
            tasks={tasks}
            categories={categories}
            onComplete={completeTask}
            onDelete={deleteTask}
            getPriorityColor={getPriorityColor}
            formatTime={formatTime}
            formatDate={formatDate}
            refreshTrigger={refreshCalendar}
            refreshAllData={refreshAllData}
          />
        </div>
        
        <div className={`${activeView === 'stats' ? 'block' : 'hidden'}`}>
          <MobileTaskStats key={refreshStats} />
        </div>
      </div>
    </div>
  )
}

// Мобильная версия карточки задачи
const MobileTaskCard = ({ task, categories, onComplete, onDelete, getPriorityColor, formatTime }) => {
  const [expanded, setExpanded] = useState(false);
  const isOverdue = task.overdue;

  const getPriorityClasses = (priority) => {
    switch (priority) {
      case 'high':
        return {
          dot: 'bg-red-500',
          badge: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
        }
      case 'medium':
        return {
          dot: 'bg-yellow-500',
          badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
        }
      case 'low':
        return {
          dot: 'bg-green-500',
          badge: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
        }
      default:
        return {
          dot: 'bg-gray-500',
          badge: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
        }
    }
  }

  const priorityClasses = getPriorityClasses(task.priority);

  return (
    <div className={`border rounded-lg p-3 ${isOverdue ? 'border-red-300 bg-red-50 dark:bg-red-900' : 'border-gray-200 dark:border-gray-700'}`}>
      <div className="flex items-start gap-2">
        <button 
          onClick={onComplete}
          className={`flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center mt-1 ${
            isOverdue 
              ? 'border-red-500 bg-red-100 dark:bg-red-800' 
              : 'border-green-500 bg-green-100 dark:bg-green-800'
          }`}
        >
          {isOverdue ? '⚠️' : '✓'}
        </button>
        
        <div className="flex-1 min-w-0" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center gap-1 mb-1 flex-wrap">
            {task.time && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                isOverdue 
                  ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200' 
                  : 'bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200'
              }`}>
                {task.time}
              </span>
            )}
            
            <h3 className={`font-medium truncate ${isOverdue ? 'text-red-700 dark:text-red-300' : 'dark:text-white'}`}>
              {task.title}
            </h3>
          </div>
          
          <div className="flex items-center gap-1 flex-wrap">
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${priorityClasses.badge}`}>
              {task.priority === 'high' ? 'Высокий' : task.priority === 'medium' ? 'Средний' : 'Низкий'}
            </span>
            
            {task.estimated_time > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                ⏱️ {formatTime(task.estimated_time)}
              </span>
            )}
            
            {task.category && (
              <span 
                className="text-xs px-1.5 py-0.5 rounded-full truncate max-w-[100px]"
                style={{ 
                  backgroundColor: `${task.category.color}20`,
                  color: task.category.color
                }}
              >
                {task.category.icon} {task.category.name}
              </span>
            )}
          </div>
        </div>
        
        <button 
          onClick={onDelete}
          className="flex-shrink-0 text-gray-400 hover:text-red-500 p-1"
        >
          🗑️
        </button>
      </div>
      
      {expanded && task.description && (
        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">{task.description}</p>
        </div>
      )}
    </div>
  )
}

// Мобильная версия выполненной задачи
const MobileCompletedTaskCard = ({ task, onDelete, getPriorityColor, formatTime }) => {
  return (
    <div className="border border-green-200 dark:border-green-800 rounded-lg p-3 bg-green-50 dark:bg-green-900">
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 w-6 h-6 rounded-full border border-green-500 bg-green-100 dark:bg-green-800 flex items-center justify-center mt-1">
          ✓
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-1 flex-wrap">
            {task.time && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200">
                {task.time}
              </span>
            )}
            
            <h3 className="font-medium truncate line-through opacity-75 dark:text-white">
              {task.title}
            </h3>
          </div>
          
          <div className="flex items-center gap-1 flex-wrap">
            {task.estimated_time > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                ⏱️ {formatTime(task.estimated_time)}
              </span>
            )}
          </div>
        </div>
        
        <button 
          onClick={onDelete}
          className="flex-shrink-0 text-gray-400 hover:text-red-500 p-1"
        >
          🗑️
        </button>
      </div>
    </div>
  )
}

// Мобильная версия календаря
const MobileTaskCalendar = ({ tasks, categories, onComplete, onDelete, getPriorityColor, formatTime, formatDate, refreshTrigger, refreshAllData }) => {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [monthTasks, setMonthTasks] = useState({})
  const [internalRefresh, setInternalRefresh] = useState(0)

  useEffect(() => {
    loadMonthTasks()
  }, [currentDate, refreshTrigger, internalRefresh])

  const loadMonthTasks = async () => {
    try {
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth()
      
      const firstDay = new Date(year, month, 1)
      const lastDay = new Date(year, month + 1, 0)
      
      const tasksPromises = []
      const current = new Date(firstDay)
      
      while (current <= lastDay) {
        const dateString = current.toISOString().split('T')[0]
        tasksPromises.push(
          axios.get(`${API_BASE}/calendar/${dateString}`)
            .then(response => ({ 
              date: dateString, 
              tasks: response.data.tasks || [] 
            }))
            .catch(error => {
              console.error(`Error loading tasks for ${dateString}:`, error)
              return { date: dateString, tasks: [] }
            })
        )
        current.setDate(current.getDate() + 1)
      }
      
      const results = await Promise.all(tasksPromises)
      const tasksMap = {}
      results.forEach(result => {
        tasksMap[result.date] = result.tasks
      })
      
      setMonthTasks(tasksMap)
    } catch (error) {
      console.error('Error loading month tasks:', error)
    }
  }

  const getTasksForDate = (date) => {
    const previousDate = new Date(date)
    previousDate.setDate(previousDate.getDate() + 1)
    const dateString = previousDate.toISOString().split('T')[0]
    return monthTasks[dateString] || []
  }

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate)
    newDate.setMonth(newDate.getMonth() + direction)
    setCurrentDate(newDate)
  }

  const getCalendarDays = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    
    const startDate = new Date(firstDay)
    const firstDayWeekday = firstDay.getDay()
    const daysToMonday = firstDayWeekday === 0 ? -6 : 1 - firstDayWeekday
    startDate.setDate(firstDay.getDate() + daysToMonday)
    
    const endDate = new Date(lastDay)
    const lastDayWeekday = lastDay.getDay()
    const daysToSunday = lastDayWeekday === 0 ? 0 : 7 - lastDayWeekday
    endDate.setDate(lastDay.getDate() + daysToSunday)
    
    const days = []
    const current = new Date(startDate)
    
    while (current <= endDate) {
      days.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }
    
    return days
  }
  
  const calendarDays = getCalendarDays()
  const today = new Date()
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <button 
          onClick={() => navigateMonth(-1)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <ChevronLeft className="w-5 h-5 dark:text-white" />
        </button>
        
        <span className="text-lg font-semibold dark:text-white">
          {currentDate.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' })}
        </span>
        
        <button 
          onClick={() => navigateMonth(1)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <ChevronRight className="w-5 h-5 dark:text-white" />
        </button>
      </div>

      {/* Дни недели */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
          <div key={day} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Календарь */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((date, index) => {
          const isCurrentMonth = date.getMonth() === currentDate.getMonth()
          const isToday = date.toDateString() === today.toDateString()
          const tasks = getTasksForDate(date)
          const completedCount = tasks.filter(task => task.completed).length
          const totalCount = tasks.length
          
          return (
            <div
              key={index}
              className={`
                aspect-square p-1 border rounded text-xs relative
                ${isCurrentMonth 
                  ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700' 
                  : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 text-gray-400'
                }
                ${isToday ? 'ring-1 ring-blue-500' : ''}
              `}
              onClick={() => setSelectedDate(date)}
            >
              <div className="flex flex-col h-full">
                <span className={`
                  font-medium text-center
                  ${isCurrentMonth ? 'text-gray-900 dark:text-white' : 'text-gray-400'}
                  ${isToday ? 'text-blue-600 dark:text-blue-400' : ''}
                `}>
                  {date.getDate()}
                </span>
                
                {/* Индикаторы задач */}
                <div className="flex-1 flex flex-col items-center justify-center">
                  {totalCount > 0 && (
                    <div className="flex flex-col items-center">
                      {completedCount > 0 && (
                        <div className="w-2 h-2 rounded-full bg-green-500 mb-0.5"></div>
                      )}
                      {totalCount > completedCount && (
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      
      {/* Детали выбранного дня */}
      {selectedDate && (
        <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-md font-semibold dark:text-white">
              {formatDate(selectedDate.toISOString())}
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({getTasksForDate(selectedDate).length})
              </span>
            </h3>
            <button 
              onClick={() => setSelectedDate(null)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>
          
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {getTasksForDate(selectedDate).map(task => (
              <div key={task.id} className={`p-2 border rounded text-sm ${task.completed ? 'bg-green-50 dark:bg-green-900' : 'bg-gray-50 dark:bg-gray-900'}`}>
                <div className="flex justify-between">
                  <span className={`font-medium ${task.completed ? 'line-through' : ''}`}>
                    {task.time && <span className="text-gray-500 mr-2">{task.time}</span>}
                    {task.title}
                  </span>
                  <button 
                    onClick={() => onComplete(task.id)}
                    className={`p-1 rounded ${task.completed ? 'bg-gray-200 dark:bg-gray-700' : 'bg-green-500 text-white'}`}
                  >
                    ✓
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Мобильная версия статистики
const MobileTaskStats = () => {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    setLoading(true)
    try {
      const response = await axios.get(`${API_BASE}/stats/`)
      setStats(response.data)
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
        <h2 className="text-lg font-semibold mb-4 dark:text-white">📊 Статистика</h2>
        <div className="text-center py-6">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
      <h2 className="text-lg font-semibold mb-4 dark:text-white">📊 Статистика дня</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="text-center p-3 bg-blue-50 dark:bg-blue-900 rounded-lg">
          <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{stats.total_tasks}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Всего задач</div>
        </div>
        <div className="text-center p-3 bg-green-50 dark:bg-green-900 rounded-lg">
          <div className="text-xl font-bold text-green-600 dark:text-green-400">{stats.completed_tasks}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Выполнено</div>
        </div>
        <div className="text-center p-3 bg-purple-50 dark:bg-purple-900 rounded-lg">
          <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
            {Math.round(stats.completion_rate)}%
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Прогресс</div>
        </div>
        <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900 rounded-lg">
          <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
            {Math.round(stats.time_completion_rate)}%
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">По времени</div>
        </div>
      </div>
      
      <div className="mt-4">
        <h3 className="text-sm font-medium dark:text-white mb-2">Приоритеты</h3>
        <div className="flex gap-2">
          <div className="flex-1 text-center p-2 bg-red-50 dark:bg-red-900 rounded">
            <div className="text-sm font-bold text-red-600 dark:text-red-400">{stats.high_priority}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Высокий</div>
          </div>
          <div className="flex-1 text-center p-2 bg-yellow-50 dark:bg-yellow-900 rounded">
            <div className="text-sm font-bold text-yellow-600 dark:text-yellow-400">{stats.medium_priority}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Средний</div>
          </div>
          <div className="flex-1 text-center p-2 bg-green-50 dark:bg-green-900 rounded">
            <div className="text-sm font-bold text-green-600 dark:text-green-400">{stats.low_priority}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Низкий</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App