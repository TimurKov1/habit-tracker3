import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';


const API_BASE = 'http://localhost:8001'

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

  useEffect(() => {
    loadTasks()
    loadCategories()
  }, [])

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
    e.preventDefault()
    if (!newTaskTitle.trim()) return
    
    try {
      const taskData = {
        title: newTaskTitle,
        description: newTaskDescription,
        priority: selectedPriority,
        estimated_time: estimatedTime,
        date: isSpecificDate ? taskDate : new Date().toISOString().split('T')[0],
        time: taskTime || null // Добавляем время
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
      setTaskTime('') // Сбрасываем время
      
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
        console.log('Creating template with repeat_days:', repeatDays, 'as string:', templateData.repeat_days) // Отладка
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-2">
            📝 Ежедневный Планировщик
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Планируйте свои задачи на сегодня и другие дни
          </p>
        </header>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold dark:text-white">
              {isCreatingTemplate ? 'Создать шаблон задачи' : 'Добавить задачу'}
            </h2>
            {/* <button
              onClick={() => setIsCreatingTemplate(!isCreatingTemplate)}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                isCreatingTemplate 
                  ? 'bg-gray-500 hover:bg-gray-600 text-white' 
                  : 'bg-purple-500 hover:bg-purple-600 text-white'
              }`}
            >
              {isCreatingTemplate ? '← Обычная задача' : '🔄 Шаблон'}
            </button> */}
          </div>
          
          <form onSubmit={isCreatingTemplate ? createTemplate : createTask} className="space-y-3">
            <div className="flex gap-3">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder={isCreatingTemplate ? "Название шаблона" : "Название задачи"}
                className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <button 
                type="submit"
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                {isCreatingTemplate ? 'Создать шаблон' : 'Добавить'}
              </button>
            </div>
            
            <textarea
              value={newTaskDescription}
              onChange={(e) => setNewTaskDescription(e.target.value)}
              placeholder="Описание (необязательно)"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows="2"
            />
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Категория
                </label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">🟢 Низкий</option>
                  <option value="medium">🟡 Средний</option>
                  <option value="high">🔴 Высокий</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Время (минуты)
                </label>
                <input
                  type="number"
                  value={estimatedTime}
                  onChange={(e) => setEstimatedTime(parseInt(e.target.value) || 0)}
                  min="0"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Добавить после поля с приоритетом, но перед кнопкой добавления */}
              <div className="mt-2">
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSpecificDate}
                    onChange={(e) => setIsSpecificDate(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Запланировать на другую дату
                  </span>
                </label>
                
                {isSpecificDate && (
                  <div className="mt-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Дата выполнения
                    </label>
                    <input
                      type="date"
                      value={taskDate}
                      onChange={(e) => setTaskDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            </div>

            {isCreatingTemplate && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">🔄 Настройки повторения</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Дата начала
                    </label>
                    <input
                      type="date"
                      value={templateStartDate}
                      onChange={(e) => setTemplateStartDate(e.target.value)}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Повторять
                    </label>
                    <select
                      value={repeatInterval}
                      onChange={(e) => setRepeatInterval(e.target.value)}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="none">Не повторять</option>
                      <option value="daily">Ежедневно</option>
                      <option value="weekly">Еженедельно</option>
                      <option value="monthly">Ежемесячно</option>
                    </select>
                  </div>

                  {repeatInterval !== 'none' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Повторять до
                      </label>
                      <input
                        type="date"
                        value={repeatUntil}
                        onChange={(e) => setRepeatUntil(e.target.value)}
                        min={templateStartDate}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>

                {repeatInterval === 'weekly' && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Дни недели
                    </label>
                    <div className="flex flex-wrap gap-1">
                    {[
                      { value: 0, label: 'Пн' },
                      { value: 1, label: 'Вт' }, 
                      { value: 2, label: 'Ср' },
                      { value: 3, label: 'Чт' },
                      { value: 4, label: 'Пт' },
                      { value: 5, label: 'Сб' },
                      { value: 6, label: 'Вс' }
                    ].map(day => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => {
                          if (repeatDays.includes(day.value.toString())) {
                            setRepeatDays(repeatDays.filter(d => d !== day.value.toString()))
                          } else {
                            setRepeatDays([...repeatDays, day.value.toString()])
                          }
                        }}
                        className={`px-2 py-1 text-xs rounded border ${
                          repeatDays.includes(day.value.toString())
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </form>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold dark:text-white">📋 Активные задачи сегодня</h2>
            <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full text-sm font-semibold">
              {tasks.today_active.length} активных
            </span>
          </div>
          
          <div className="space-y-3">
            {tasks.today_active.map(task => (
              <TaskCard 
                key={task.id} 
                task={task} 
                categories={categories}
                onComplete={() => completeTask(task.id)}
                onDelete={() => deleteTask(task.id)}
                getPriorityColor={getPriorityColor}
                formatTime={formatTime}
                isTemplate={false}
              />
            ))}
            {tasks.today_active.length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p className="text-lg">Нет активных задач на сегодня</p>
                <p className="text-sm">Добавьте первую задачу выше</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold dark:text-white">✅ Выполнено сегодня</h2>
            <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-3 py-1 rounded-full text-sm font-semibold">
              {tasks.today_completed.length} выполнено
            </span>
          </div>
          
          <div className="space-y-3">
            {tasks.today_completed.map(task => (
              <CompletedTaskCard 
                key={task.id} 
                task={task} 
                onDelete={() => deleteTask(task.id)}
                getPriorityColor={getPriorityColor}
                formatTime={formatTime}
              />
            ))}
            {tasks.today_completed.length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p className="text-lg">Сегодня еще нет выполненных задач</p>
                <p className="text-sm">Выполните активные задачи выше</p>
              </div>
            )}
          </div>
        </div>

        <TaskCalendar 
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

        {/* <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold dark:text-white">📋 Шаблоны повторяющихся задач</h2>
            <span className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-3 py-1 rounded-full text-sm font-semibold">
              {(tasks.templates && tasks.templates.length) || 0} шаблонов
            </span>
          </div>
          
          <div className="space-y-3">
            {tasks.templates && tasks.templates.map(template => (
              <TemplateCard 
                key={template.id} 
                template={template} 
                categories={categories}
                onDelete={() => deleteTemplate(template.id)}
                getRepeatLabel={getRepeatLabel}
                formatTime={formatTime}
              />
            ))}
            {(!tasks.templates || tasks.templates.length === 0) && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p className="text-lg">Нет шаблонов повторяющихся задач</p>
                <p className="text-sm">Создайте первый шаблон выше</p>
              </div>
            )}
          </div>
        </div> */}

        <TaskStats key={refreshStats}/>
      </div>
    </div>
  )
}

const TaskCard = ({ task, categories, onComplete, onDelete, getPriorityColor, formatTime, isTemplate }) => {
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

  const priorityClasses = getPriorityClasses(task.priority)
  const isVirtual = task.id && String(task.id).startsWith('template_')

  return (
    <div className="flex items-center justify-between p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 hover:shadow-md transition-all">
      <div className="flex items-center gap-3 flex-1">
        {task.time && (
              <span className="text-md font-medium bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                ⏰ {task.time}
              </span>
        )}
        <div className="flex-1">
          <div className="flex items-start mb-1">
            <h3 className="font-semibold dark:text-white text-lg opacity-75">
              {task.title}
            </h3>
          </div>
          {task.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              {task.description}
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${priorityClasses.badge}`}>
              {task.priority === 'high' ? 'Высокий' : task.priority === 'medium' ? 'Средний' : 'Низкий'} приоритет
            </span>
            {task.estimated_time > 0 && (
              <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 font-medium">
                ⏱️ {formatTime(task.estimated_time)}
              </span>
            )}
            {task.category && (
              <span 
                className="text-xs px-2 py-1 rounded-full font-medium"
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
      </div>
      
      <div className="flex gap-2">
        <button 
          onClick={onComplete}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
        >
          ✓ Выполнено
        </button>
        <button 
          onClick={onDelete}
          className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg transition-colors"
        >
          🗑️
        </button>
      </div>
    </div>
  )
}

const CompletedTaskCard = ({ task, onDelete, getPriorityColor, formatTime }) => {
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

  const priorityClasses = getPriorityClasses(task.priority)

  return (
    <div className="flex items-center justify-between p-4 border-2 border-green-200 dark:border-green-800 rounded-lg bg-green-50 dark:bg-green-900">
      <div className="flex items-center gap-3">
        {task.time && (
              <span className="text-md font-medium bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                ⏰ {task.time}
              </span>
        )}
        <div className='flex-1'>
          <div className="flex justify-between items-start mb-1">
            <h3 className="font-semibold dark:text-white text-lg line-through opacity-75">
              {task.title}
            </h3>
          </div>
          {task.description && (
            <p className="text-sm text-green-600 dark:text-green-400 mb-1">
              {task.description}
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${priorityClasses.badge}`}>
              {task.priority === 'high' ? 'Высокий' : task.priority === 'medium' ? 'Средний' : 'Низкий'} приоритет
            </span>
            {task.estimated_time > 0 && (
              <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 font-medium">
                ⏱️ {formatTime(task.estimated_time)}
              </span>
            )}
            {task.category && (
              <span 
                className="text-xs px-2 py-1 rounded-full font-medium"
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
      </div>
      <button 
        onClick={onDelete}
        className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg transition-colors"
      >
        🗑️
      </button>
    </div>
  )
}

const TemplateCard = ({ template, categories, onDelete, getRepeatLabel, formatTime }) => {
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

  const priorityClasses = getPriorityClasses(template.priority)

  return (
    <div className="flex items-center justify-between p-4 border-2 border-purple-200 dark:border-purple-800 rounded-lg bg-purple-50 dark:bg-purple-900">
      <div className="flex items-center gap-3 flex-1">
        <div className={`w-3 h-3 rounded-full ${priorityClasses.dot}`}></div>
        <div className="flex-1">
          <div className="flex justify-between items-start mb-1">
            <h3 className="font-semibold dark:text-white text-lg">
              {template.title} <span className="text-sm text-purple-600 dark:text-purple-400">(шаблон)</span>
            </h3>
            {template.time && (
              <span className="text-sm font-medium bg-purple-100 dark:bg-purple-800 text-purple-800 dark:text-purple-200 px-2 py-1 rounded">
                ⏰ {template.time}
              </span>
            )}
          </div>
          {template.description && (
            <p className="text-sm text-purple-600 dark:text-purple-400 mb-1">
              {template.description}
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${priorityClasses.badge}`}>
              {template.priority === 'high' ? 'Высокий' : template.priority === 'medium' ? 'Средний' : 'Низкий'} приоритет
            </span>
            {template.estimated_time > 0 && (
              <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 font-medium">
                ⏱️ {formatTime(template.estimated_time)}
              </span>
            )}
            {template.category_id && categories.find(cat => cat.id === template.category_id) && (
              <span 
                className="text-xs px-2 py-1 rounded-full font-medium"
                style={{ 
                  backgroundColor: `${categories.find(cat => cat.id === template.category_id).color}20`,
                  color: categories.find(cat => cat.id === template.category_id).color
                }}
              >
                {categories.find(cat => cat.id === template.category_id).icon} {categories.find(cat => cat.id === template.category_id).name}
              </span>
            )}
            {template.date && (
              <span className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 font-medium">
                📅 Дата: {new Date(template.date).toLocaleDateString('ru-RU')}
              </span>
            )}
            <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 font-medium">
              🔄 {getRepeatLabel(template.repeat_interval, template.repeat_days)}
              {template.repeat_until && ` до ${new Date(template.repeat_until).toLocaleDateString('ru-RU')}`}
            </span>
            <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 font-medium">
              📅 Начало: {new Date(template.start_date).toLocaleDateString('ru-RU')}
            </span>
          </div>
        </div>
      </div>
      
      <button 
        onClick={onDelete}
        className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg transition-colors"
        title="Удалить шаблон и все связанные задачи"
      >
        🗑️
      </button>
    </div>
  )
}

const TaskCalendar = ({ tasks, categories, onComplete, onDelete, getPriorityColor, formatTime, formatDate, refreshTrigger, refreshAllData }) => {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [monthTasks, setMonthTasks] = useState({})
  const [internalRefresh, setInternalRefresh] = useState(0)
  const [activeTask, setActiveTask] = useState(null) // Для drag and drop
  const [draggedTaskId, setDraggedTaskId] = useState(null) // ID перетаскиваемой задачи

  // Загружаем задачи для всего месяца
  useEffect(() => {
    loadMonthTasks()
  }, [currentDate, refreshTrigger, internalRefresh])

  const refreshCalendar = () => {
    setInternalRefresh(prev => prev + 1)
  }

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

  // Функция для перемещения задачи на другую дату
  // App.jsx - функция moveTaskToDate в компоненте TaskCalendar
  const moveTaskToDate = async (taskId, newDate) => {
    try {
      // Используем новый эндпоинт для перемещения задачи
      await axios.put(`${API_BASE}/tasks/${taskId}/move`, {
        date: newDate
      });

      // Перезагружаем ВСЕ данные
      await loadMonthTasks() // Загружаем данные календаря
      loadTasks() // Загружаем списки задач (включая "активные сегодня" и "выполненные сегодня")
      setRefreshCalendar(prev => prev + 1)
      setRefreshStats(prev => prev + 1) // Обновляем статистику
      
    } catch (error) {
      console.error('Error moving task:', error)
      // Если новый эндпоинт не работает, используем старую логику
      try {
        // Получаем задачу
        const response = await axios.get(`${API_BASE}/tasks/`)
        const allTasks = [
          ...response.data.today_active,
          ...response.data.today_completed,
          ...response.data.other_days
        ]
        
        const taskToMove = allTasks.find(t => t.id === taskId)
        if (!taskToMove) return

        // Обновляем задачу
        await axios.put(`${API_BASE}/tasks/${taskId}`, {
          title: taskToMove.title,
          description: taskToMove.description,
          category_id: taskToMove.category_id,
          priority: taskToMove.priority,
          estimated_time: taskToMove.estimated_time,
          date: newDate,
          time: taskToMove.time,
          repeat_interval: taskToMove.repeat_interval || "none",
          repeat_days: taskToMove.repeat_days,
          repeat_until: taskToMove.repeat_until
        })
        
        // Перезагружаем ВСЕ данные
        await loadMonthTasks()
        await refreshAllData()
        
      } catch (fallbackError) {
        console.error('Fallback error moving task:', fallbackError)
      }
    }
  }

  // Обработчики drag and drop
  const handleDragStart = (event) => {
    const { active } = event
    setDraggedTaskId(active.id)
    setActiveTask(active.data.current?.task)
  }

  const handleDragEnd = async (event) => {
    const { active, over } = event
    
    setDraggedTaskId(null)
    setActiveTask(null)
    
    if (!over) return
    
    const taskId = active.id
    const targetDateStr = over.id
    console.log(taskId);
    
    if (taskId && targetDateStr && targetDateStr.startsWith('date-')) {
      const dateStr = targetDateStr.replace('date-', '')
      await moveTaskToDate(taskId, dateStr)
    }
  }

  const handleComplete = async (taskId) => {
    await onComplete(taskId)
    refreshCalendar()
  }

  const handleDelete = async (taskId) => {
    await onDelete(taskId)
    refreshCalendar()
  }

  // Генерируем календарь на месяц
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
  
  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate)
    newDate.setMonth(newDate.getMonth() + direction)
    setCurrentDate(newDate)
  }
  
  const calendarDays = getCalendarDays()
  const today = new Date()
  
  // Компонент для перетаскиваемого элемента задачи
  const DraggableTask = ({ task, date }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
      id: task.id,
      data: {
        task,
        date
      }
    })
    
    const style = {
      transform: CSS.Transform.toString(transform),
      opacity: isDragging ? 0.5 : 1,
      cursor: 'grab'
    }
    
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`text-xs p-1 rounded truncate ${
          task.completed 
            ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200' 
            : 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200'
        } ${isDragging ? 'shadow-lg' : ''}`}
        title={task.title}
      >
        <span className='font-bold'>{task.time}</span> | <span className={`${task.completed ? 'line-through' : ''}`}>{task.title}</span>
      </div>
    )
  }
  
  // Компонент для области сброса (дня календаря)
  const CalendarDayDropZone = ({ date, children, isCurrentMonth, isToday, isSelected }) => {
    const dateStr = new Date(date)
    dateStr.setDate(dateStr.getDate() - 1)
    const isoDateStr = dateStr.toISOString().split('T')[0]
    
    const { isOver, setNodeRef } = useDroppable({
      id: `date-${isoDateStr}`,
      data: {
        date: isoDateStr
      }
    })
    
    const dateTasks = getTasksForDate(date)
    const completedCount = dateTasks.filter(task => task.completed).length
    const totalCount = dateTasks.length
    
    return (
      <div
        ref={setNodeRef}
        className={`
          min-h-24 p-2 border rounded-lg cursor-pointer transition-all relative
          ${isCurrentMonth 
            ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700' 
            : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 text-gray-400'
          }
          ${isToday ? 'ring-2 ring-blue-500' : ''}
          ${isSelected ? 'bg-blue-50 dark:bg-blue-900 border-blue-300 dark:border-blue-700' : ''}
          ${isOver ? 'bg-purple-50 dark:bg-purple-900 border-purple-300 dark:border-purple-700' : ''}
          hover:bg-gray-50 dark:hover:bg-gray-700
        `}
        onClick={() => setSelectedDate(date)}
      >
        {isOver && (
          <div className="absolute inset-0 border-2 border-dashed border-purple-400 rounded-lg bg-purple-50 bg-opacity-50 dark:bg-purple-900 dark:bg-opacity-30 z-10 flex items-center justify-center">
            <span className="text-xs text-purple-600 dark:text-purple-300">Переместить сюда</span>
          </div>
        )}
        
        <div className="flex justify-between items-start mb-1 relative z-20">
          <span className={`
            text-sm font-medium
            ${isCurrentMonth ? 'text-gray-900 dark:text-white' : 'text-gray-400'}
            ${isToday ? 'text-blue-600 dark:text-blue-400' : ''}
          `}>
            {date.getDate()}
          </span>

          {/* Индикаторы задач */}
          {totalCount > 0 && (
            <div className="flex gap-1">
              {completedCount > 0 && (
                <span className="bg-green-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center" 
                      title={`${completedCount} выполнено`}>
                  {completedCount}
                </span>
              )}
              {totalCount > completedCount && (
                <span className="bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center"
                      title={`${totalCount - completedCount} активных`}>
                  {totalCount - completedCount}
                </span>
              )}
            </div>
          )}
        </div>
        
        {/* Список задач с возможностью перетаскивания */}
        <div className="space-y-1 max-h-16 overflow-y-auto relative z-20">
          {dateTasks.map(task => (
            <DraggableTask key={task.id} task={task} date={isoDateStr} />
          ))}
        </div>
      </div>
    )
  }
  
  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold dark:text-white">📅 Календарь задач</h2>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigateMonth(-1)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              ←
            </button>
            <span className="text-lg font-semibold dark:text-white">
              {currentDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
            </span>
            <button 
              onClick={() => navigateMonth(1)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              →
            </button>
            <button 
              onClick={() => {
                setCurrentDate(new Date())
                setSelectedDate(new Date())
              }}
              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
            >
              Сегодня
            </button>
          </div>
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          💡 Перетащите задачу на другой день, чтобы изменить дату выполнения
        </div>

        {/* Дни недели */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
            <div key={day} className="text-center text-sm font-medium text-gray-500 dark:text-gray-400 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Календарь с drag and drop */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((date, index) => {
            const isCurrentMonth = date.getMonth() === currentDate.getMonth()
            const isToday = date.toDateString() === today.toDateString()
            const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString()
            
            return (
              <CalendarDayDropZone
                key={index}
                date={date}
                isCurrentMonth={isCurrentMonth}
                isToday={isToday}
                isSelected={isSelected}
              />
            )
          })}
        </div>

        {/* Drag overlay (превью при перетаскивании) */}
        <DragOverlay>
          {activeTask && (
            <div className="text-xs p-2 rounded truncate bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200 shadow-lg">
              <span className='font-bold'>{activeTask.time}</span> | {activeTask.title}
            </div>
          )}
        </DragOverlay>
        
        {/* Детали выбранного дня */}
        {selectedDate && (
          <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold dark:text-white">
                Задачи на {formatDate(selectedDate.toISOString())}
                <span className="text-sm font-normal text-gray-500 ml-2">
                  ({getTasksForDate(selectedDate).length} задач)
                </span>
              </h3>
              <button 
                onClick={() => setSelectedDate(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-3">
              {getTasksForDate(selectedDate).map(task => (
                <CalendarTaskCard 
                  key={task.id} 
                  task={task} 
                  onComplete={() => handleComplete(task.id)}
                  onDelete={() => handleDelete(task.id)}
                  getPriorityColor={getPriorityColor}
                  formatTime={formatTime}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </DndContext>
  )
}

const CalendarTaskCard = ({ task, onComplete, onDelete, getPriorityColor, formatTime }) => {
  const isCompleted = task.completed
  const isVirtual = task.is_virtual
  const isTemplateBased = task.is_template_based

  const getPriorityBadgeClasses = (priority) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200 border border-red-200 dark:border-red-700'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-700'
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200 border border-green-200 dark:border-green-700'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700'
    }
  }

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'high':
        return '🔴'
      case 'medium':
        return '🟡'
      case 'low':
        return '🟢'
      default:
        return '⚪'
    }
  }

  return (
    <div className={`flex items-center justify-between p-3 border rounded-lg ${
      isCompleted 
        ? 'bg-green-50 dark:bg-green-900 border-green-200 dark:border-green-800' 
        : isVirtual
          ? 'bg-purple-50 dark:bg-purple-900 border-purple-200 dark:border-purple-800'
          : ' dark:bg-blue-900 border-gray-200 dark:border-blue-700'
    }`}>
      <div className="flex items-center gap-3 flex-1">

        {task.time && (
              <span className={`text-md font-medium px-2 py-1 rounded ${
                isCompleted 
                  ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200' 
                  : isVirtual
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-200'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200'
              }`}>
                ⏰ {task.time}
              </span>
            )}
        
        <div className="flex-1">
          <div className="flex justify-between items-start mb-1">
            <h3 className={`font-semibold text-sm ${
              isCompleted 
                ? 'line-through text-green-800 dark:text-green-200' 
                : isVirtual
                  ? 'text-purple-800 dark:text-purple-200'
                  : 'text-gray-800 dark:text-blue-200'
            }`}>
              {task.title}
              {isVirtual && <span className="text-xs ml-1 opacity-75">(виртуальная)</span>}
              {isTemplateBased && !isVirtual && <span className="text-xs ml-1 opacity-75">(из шаблона)</span>}
            </h3>
          </div>
          
          {task.description && (
            <p className={`text-xs mb-1 ${
              isCompleted 
                ? 'text-green-600 dark:text-green-400' 
                : isVirtual
                  ? 'text-purple-600 dark:text-purple-400'
                  : 'text-blue-600 dark:text-blue-400'
            }`}>
              {task.description}
            </p>
          )}
          
          <div className="flex items-center gap-2 flex-wrap">
            {/* Категория */}
            {task.category && (
              <span 
                className="text-xs px-2 py-1 rounded-full font-medium"
                style={{ 
                  backgroundColor: `${task.category.color}20`,
                  color: task.category.color
                }}
              >
                {task.category.icon} {task.category.name}
              </span>
            )}
            
            {/* Бейдж приоритета с разными цветами */}
            <span className={`text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 ${getPriorityBadgeClasses(task.priority)}`}>
              <span>{getPriorityIcon(task.priority)}</span>
              {task.priority === 'high' ? 'Высокий' : task.priority === 'medium' ? 'Средний' : 'Низкий'}
            </span>
            
            {task.estimated_time > 0 && (
              <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200 font-medium">
                ⏱️ {formatTime(task.estimated_time)}
              </span>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex gap-2">
        {!isCompleted && (
          <button 
            onClick={onComplete}
            className="bg-green-500 hover:bg-green-600 text-white p-2 rounded transition-colors"
          >
            ✓
          </button>
        )}
        <button 
          onClick={onDelete}
          className="bg-red-500 hover:bg-red-600 text-white p-2 rounded transition-colors"
          title={isVirtual ? "Создать исключение для этого дня" : "Удалить задачу"}
        >
          🗑️
        </button>
      </div>
    </div>
  )
}

const TaskStats = () => {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)

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

  // Загружаем статистику при монтировании
  useEffect(() => {
    loadStats()
  }, [])

  // Если stats еще не загружены, показываем заглушку
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-semibold mb-4 dark:text-white">📊 Статистика дня</h2>
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="mt-2 text-gray-500 dark:text-gray-400">Загрузка статистики...</p>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-semibold mb-4 dark:text-white">📊 Статистика дня</h2>
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">Не удалось загрузить статистику</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <h2 className="text-2xl font-semibold mb-4 dark:text-white">📊 Статистика дня</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.total_tasks}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Всего задач сегодня</div>
        </div>
        <div className="text-center p-4 bg-green-50 dark:bg-green-900 rounded-lg">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.completed_tasks}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Выполнено сегодня</div>
        </div>
        <div className="text-center p-4 bg-purple-50 dark:bg-purple-900 rounded-lg">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {Math.round(stats.completion_rate)}%
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Прогресс</div>
        </div>
        <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900 rounded-lg">
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {Math.round(stats.time_completion_rate)}%
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">По времени</div>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4 mt-4">
        <div className="text-center p-3 bg-red-50 dark:bg-red-900 rounded-lg">
          <div className="text-lg font-bold text-red-600 dark:text-red-400">{stats.high_priority}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Высокий приоритет</div>
        </div>
        <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900 rounded-lg">
          <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{stats.medium_priority}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Средний приоритет</div>
        </div>
        <div className="text-center p-3 bg-green-50 dark:bg-green-900 rounded-lg">
          <div className="text-lg font-bold text-green-600 dark:text-green-400">{stats.low_priority}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Низкий приоритет</div>
        </div>
      </div>
    </div>
  )
}

export default App