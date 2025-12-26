/**
 * Shared translations for Supabase Edge Functions (Telegram bot)
 * 
 * All Armenian texts use proper Armenian script.
 */

export type Language = 'ARM' | 'RU';

export const botTranslations = {
  ARM: {
    // Welcome and language selection
    welcome: 'Barev dzez, sa MedBook botn e. Khndrum enq yntrel lezuy.',
    languageButton: '🇦🇲 Hayeren',

    // Patient registration
    enterName: 'Khndrum enq grel dzez anuny ev azganuny.',
    sharePhone: 'Khndrum enq kisvatsnel dzez herakhosy.',
    sharePhoneButton: '📱 Kisvatsnel herakhosy',
    skipPhone: 'Bats toel',

    // Service selection
    chooseService: 'Yntreq tsarrayutyuny.',
    otherService: '🔹 Ayl',
    enterCustomReason: 'Nkaragreq dzez aytselman patchary.',

    // Date and time selection
    chooseDate: 'Yntreq amsativy.',
    chooseTime: 'Yntreq zhamy.',
    noSlots: 'Ayd ory azat zhamer chkan. Khndrum enq yntreq mek ayl or.',

    // Booking confirmation
    confirmBooking: 'Hastatieq granchomy.',
    service: 'Tsarrayutyun',
    dateTime: 'Amsativ ev zham',
    yes: '✅ Hastatiel',
    no: '❌ Chegharkel',
    back: '◀️ Het',

    // After booking
    bookingConfirmed: '✅ Dzez granchomy stacvel e. Bzhishky piti hastati ayn.',
    waitConfirmation: 'Spasum enq bzhishki hastatmany...',

    // Appointment status notifications
    appointmentConfirmed: '✅ Dzez granchomy hastatvats e.\n\n👨‍⚕️ Bzhishk. Doktor {doctorName}\n📅 {dateTime}',
    appointmentRejected: '❌ Dzez granchomy merjvats e.\n\nPatchar. {reason}',
    
    // Cancellation messages
    cancelledByDoctor: '❌ Dzez granchomy chegharkvats e bzhishki koghmits.',
    reason: 'Patchar.',
    rebookMessage: 'Khndrum enq grancvel nor zhami hamar.',

    // Doctor notifications
    newDoctor: '👨‍⚕️ Nor granchman harcum.\n\nHivand. {patientName}\nTsarrayutyun. {service}\nAmsativ. {dateTime}\n\nYntreq gortsoghutyuny.',
    confirm: '✅ Hastatiel',
    reject: '❌ Merjel',
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
  },
};

export function getBotTranslation(lang: Language) {
  return botTranslations[lang] || botTranslations.RU;
}
