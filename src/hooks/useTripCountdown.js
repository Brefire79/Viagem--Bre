import { useState, useEffect } from 'react';

const useTripCountdown = (startDate, endDate) => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    hasStarted: false,
    hasEnded: false,
    dayOfTrip: 0
  });

  useEffect(() => {
    if (!startDate) {
      setTimeLeft({ days: 0, hours: 0, minutes: 0, hasStarted: false, hasEnded: false, dayOfTrip: 0 });
      return;
    }

    const calculateTimeLeft = () => {
      const now = new Date();
      let tripStart, tripEnd;
      
      // Converter a data de início para Date objeto
      if (startDate?.toDate) {
        tripStart = startDate.toDate();
      } else if (startDate instanceof Date) {
        tripStart = startDate;
      } else if (typeof startDate === 'string') {
        // Forçar interpretação como data local, não UTC
        const [year, month, day] = startDate.split('-').map(Number);
        tripStart = new Date(year, month - 1, day);
      } else {
        console.warn('[TripCountdown] Data de início inválida:', startDate);
        return { days: 0, hours: 0, minutes: 0, hasStarted: false, hasEnded: false, dayOfTrip: 0 };
      }
      
      // Converter a data de fim para Date objeto
      if (endDate) {
        if (endDate?.toDate) {
          tripEnd = endDate.toDate();
        } else if (endDate instanceof Date) {
          tripEnd = endDate;
        } else if (typeof endDate === 'string') {
          const [year, month, day] = endDate.split('-').map(Number);
          tripEnd = new Date(year, month - 1, day);
        }
      }

      // Normalizar as datas para meia-noite no fuso horário local
      const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tripStartDate = new Date(tripStart.getFullYear(), tripStart.getMonth(), tripStart.getDate());
      
      const diffInMs = tripStartDate.getTime() - nowDate.getTime();
      const diffInDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));

      // Se a viagem ainda não começou
      if (diffInDays > 0) {
        // Para horas e minutos, usar o horário exato
        const exactDiff = tripStart.getTime() - now.getTime();
        const hours = Math.floor((exactDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((exactDiff % (1000 * 60 * 60)) / (1000 * 60));

        return {
          days: diffInDays,
          hours: Math.max(0, hours),
          minutes: Math.max(0, minutes),
          hasStarted: false,
          hasEnded: false,
          dayOfTrip: 0
        };
      } else if (diffInDays === 0) {
        // É o dia da viagem
        return {
          days: 0,
          hours: 0,
          minutes: 0,
          hasStarted: true,
          hasEnded: false,
          dayOfTrip: 1
        };
      } else {
        // A viagem já começou
        const daysSinceStart = Math.abs(diffInDays) + 1;
        
        // Verificar se a viagem terminou
        let hasEnded = false;
        if (tripEnd) {
          const tripEndDate = new Date(tripEnd.getFullYear(), tripEnd.getMonth(), tripEnd.getDate());
          hasEnded = nowDate.getTime() > tripEndDate.getTime();
        }
        
        return {
          days: 0,
          hours: 0,
          minutes: 0,
          hasStarted: true,
          hasEnded,
          dayOfTrip: daysSinceStart
        };
      }
    };

    // Calcular tempo inicial
    setTimeLeft(calculateTimeLeft());

    // Atualizar a cada minuto (60 segundos)
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 60000);

    // Também atualizar a cada segundo para o último minuto para ser mais preciso
    const secondTimer = setInterval(() => {
      const timeData = calculateTimeLeft();
      if (timeData.days === 0 && timeData.hours === 0 && timeData.minutes === 0 && !timeData.hasStarted) {
        setTimeLeft(calculateTimeLeft());
      }
    }, 1000);

    return () => {
      clearInterval(timer);
      clearInterval(secondTimer);
    };
  }, [startDate, endDate]);

  return timeLeft;
};

export default useTripCountdown;