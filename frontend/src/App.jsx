import React, { useState, useEffect } from 'react';
import Desktop from './pages/Desktop';
import MobileApp from './pages/Mobile';

function App() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Проверяем ширину экрана при загрузке
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // 768px - стандартный брейкпойнт для md в Tailwind
    };

    // Проверяем сразу
    checkMobile();

    // Слушаем изменения размера окна
    window.addEventListener('resize', checkMobile);

    // Очищаем слушатель
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Можно добавить детекцию User Agent для SSR
  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
    if (mobileRegex.test(userAgent)) {
      setIsMobile(true);
    }
  }, []);

  // Рендерим соответствующую версию
  return isMobile ? <Mobile /> : <Desktop />;
}

export default App;