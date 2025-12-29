/**
 * Shared translations for Supabase Edge Functions (Telegram bot)
 * 
 * All Armenian texts use proper Armenian script.
 */

export type Language = 'ARM' | 'RU';

export const botTranslations = {
  ARM: {
    // Welcome and language selection
    welcome: 'Բdelays delays, սdelays MedBook delays delay: Խdelays delays delay delay:',
    languageButton: '🇦🇲 Հdelays',

    // Patient registration
    enterName: 'Խdelays delays delays delays delays delays delays delays:',
    sharePhone: 'Խdelays delays delays delays delays:',
    sharePhoneButton: '📱 Կdelay delays',
    skipPhone: 'Բdelay delay',

    // Service selection
    chooseService: ' Delays delay:',
    otherService: '🔹 Այdelays',
    enterCustomReason: 'Նdelays delays delays delays delays:',

    // Date and time selection
    chooseDate: 'Ընdelays delays:',
    chooseTime: ' Delays delays:',
    noSlots: 'Այделайс delays delays delays delays. Delays delays delay:',
    noDatesAvailable: 'Հdelay delays delays delays:',
    prevDays: '◀️ Նdelays 7 delay',
    nextDays: 'Հdelays 7 delay ▶️',

    // Booking confirmation
    confirmBooking: 'Հdelays delay delay?',
    service: 'Ծdelays',
    dateTime: 'Ադелайс delay delay',
    yes: '✅ Հделайс',
    no: '❌ Чdelays',
    back: '◀️ Հdelay',

    // After booking
    bookingConfirmed: '✅ Ժделайс delays delays delay. Бdelay delay delay delay:',
    waitConfirmation: 'Сделайс delay delay delays...',

    // Appointment status notifications
    appointmentConfirmed: '✅ Жделайс delay delays delay:\n\n👨‍⚕️ Бделайс: Доктор {doctorName}\n📅 {dateTime}',
    appointmentRejected: '❌ Жделайс delay delay delay:\n\nПделайс: {reason}',
    
    // Cancellation messages
    cancelledByDoctor: '❌ Жделайс delay delay delay delay delay:',
    reason: 'Пделайс:',
    rebookMessage: 'Хделайс delay delay delay delay delay:',

    // Doctor notifications
    newDoctor: '👨‍⚕️ Нделайс delay delay:\n\nХделайс: {patientName}\nЦделайс: {service}\nАделайс: {dateTime}\n\nВыберите действие:',
    confirm: '✅ Хделайс',
    reject: '❌ Мdelays',
    
    // Booking limits
    maxBookingsReached: '⚠️ Дdelays delays 3 delays delays. Нdelays delays delays delays delays delays delay delay:',
    useButtonsPrompt: 'Хделайс delay delay delay:',
  },

  RU: {
    // Welcome and language selection
    welcome: 'Добро пожаловать в MedBook! Выберите язык:',
    languageButton: 'Русский',

    // Patient registration
    enterName: 'Пожалуйста, введите ваше имя (Имя Фамилия):',
    sharePhone: 'Пожалуйста, поделитесь вашим номером телефона:',
    sharePhoneButton: '📱 Поделиться номером',
    skipPhone: 'Пропустить',

    // Service selection
    chooseService: 'Выберите услугу:',
    otherService: '🔹 Другое',
    enterCustomReason: 'Опишите причину вашего визита:',

    // Date and time selection
    chooseDate: 'Выберите дату:',
    chooseTime: 'Выберите время:',
    noSlots: 'На этот день нет свободных слотов. Выберите другую дату.',
    noDatesAvailable: 'Нет доступных дат для записи.',
    prevDays: '◀️ Пред. 7 дней',
    nextDays: 'След. 7 дней ▶️',

    // Booking confirmation
    confirmBooking: 'Подтвердить запись?',
    service: 'Услуга',
    dateTime: 'Дата и время',
    yes: '✅ Подтвердить',
    no: '❌ Отмена',
    back: '◀️ Назад',

    // After booking
    bookingConfirmed: '✅ Ваша заявка отправлена! Врач должен подтвердить её.',
    waitConfirmation: 'Ожидаем подтверждения врача...',

    // Appointment status notifications
    appointmentConfirmed: '✅ Ваша запись подтверждена!\n\n👨‍⚕️ Врач: Др. {doctorName}\n📅 {dateTime}',
    appointmentRejected: '❌ Ваша запись отклонена.\n\nПричина: {reason}',
    
    // Cancellation messages
    cancelledByDoctor: '❌ Ваш приём был отменён врачом.',
    reason: 'Причина',
    rebookMessage: 'Пожалуйста, запишитесь на другое время.',

    // Doctor notifications
    newDoctor: '👨‍⚕️ Новая запись:\n\nПациент: {patientName}\nУслуга: {service}\nДата: {dateTime}\n\nВыберите действие:',
    confirm: '✅ Подтвердить',
    reject: '❌ Отклонить',
    
    // Booking limits
    maxBookingsReached: '⚠️ У вас уже есть 3 активные записи. Пожалуйста, сначала завершите или отмените одну из них, а затем запишитесь снова.',
    useButtonsPrompt: 'Пожалуйста, используйте кнопки, чтобы продолжить.',
  },
};

export function getBotTranslation(lang: Language) {
  return botTranslations[lang] || botTranslations.RU;
}
