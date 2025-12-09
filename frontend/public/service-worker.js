// frontend/public/service-worker.js
const API_BASE = 'http://localhost:8001';

// Устанавливаем Service Worker
self.addEventListener('install', (event) => {
  console.log('✅ Service Worker установлен');
  self.skipWaiting();
});

// Активируем Service Worker
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker активирован');
  event.waitUntil(clients.claim());
  
  // Запускаем периодическую проверку уведомлений
  startNotificationChecking();
});

// Функция периодической проверки уведомлений
function startNotificationChecking() {
  // Проверяем каждую минуту
  setInterval(async () => {
    try {
      const clientsList = await clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });
      
      if (clientsList.length > 0) {
        // Отправляем сообщение активному клиенту для проверки
        clientsList.forEach(client => {
          client.postMessage({
            type: 'CHECK_NOTIFICATIONS',
            time: new Date().toISOString()
          });
        });
      } else {
        // Если нет активных клиентов, проверяем из Service Worker
        await checkNotificationsFromSW();
      }
    } catch (error) {
      console.error('Error in notification check:', error);
    }
  }, 60000); // Каждую минуту
  
  // Проверяем сразу при активации
  checkNotificationsFromSW();
}

// Проверка уведомлений из Service Worker
async function checkNotificationsFromSW() {
  try {
    console.log('🔄 Service Worker: проверяю уведомления...');
    
    // Получаем задачи для уведомлений с сервера
    const response = await fetch(`${API_BASE}/notifications/check`);
    if (!response.ok) {
      throw new Error('Failed to fetch notifications');
    }
    
    const data = await response.json();
    const notifications = data.notifications || [];
    
    console.log(`📨 Найдено уведомлений: ${notifications.length}`);
    
    // Показываем каждое уведомление
    for (const notification of notifications) {
      await showNotificationFromSW(notification);
    }
  } catch (error) {
    console.error('❌ Service Worker ошибка проверки:', error);
  }
}

// Показ уведомления из Service Worker
async function showNotificationFromSW(notificationData) {
  const options = {
    body: `Через 30 минут: ${notificationData.title}`,
    icon: '/vite.svg',
    badge: '/vite.svg',
    tag: `task-${notificationData.task_id}`,
    requireInteraction: true,
    silent: false,
    vibrate: [200, 100, 200],
    data: {
      taskId: notificationData.task_id,
      taskTitle: notificationData.title,
      time: notificationData.time,
      url: '/'
    },
    actions: [
      {
        action: 'open',
        title: 'Открыть'
      },
      {
        action: 'snooze',
        title: 'Отложить 5 мин'
      }
    ]
  };
  
  await self.registration.showNotification('📅 Напоминание', options);
  console.log(`✅ Уведомление отправлено: ${notificationData.title}`);
}

// Обработка кликов по уведомлению
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Уведомление кликнуто:', event.notification.tag);
  
  event.notification.close();
  
  if (event.action === 'open') {
    // Открываем приложение
    event.waitUntil(
      clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes('/') && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  } else if (event.action === 'snooze') {
    // Отложить на 5 минут
    console.log('Откладываем задачу на 5 минут');
    // Здесь можно отправить запрос на сервер
  }
});

// Получаем сообщения от основного приложения
self.addEventListener('message', (event) => {
  
  if (event.data && event.data.type === 'CHECK_NOTIFICATIONS_NOW') {
    checkNotificationsFromSW();
  }
});

// Пуш уведомления
self.addEventListener('push', (event) => {
  console.log('🚀 Push уведомление получено');
  
  let data = {
    title: 'Напоминание',
    body: 'Время выполнить задачу!'
  };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/vite.svg',
      tag: 'push-notification'
    })
  );
});