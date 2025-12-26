/**
 * Shared translations for Supabase Edge Functions (Telegram bot)
 * 
 * IMPORTANT: All Armenian texts MUST be in proper Armenian script (Հայdelays)
 * Do NOT use Latin characters for Armenian!
 * 
 * TODO: Replace all Latin transliterations with proper Armenian script
 */

export type Language = 'ARM' | 'RU';

export const botTranslations = {
  ARM: {
    // Welcome and language selection
    welcome: 'Barev dzez MedBook! Yntreq lezu:', // TODO: Բdelays dzez MedBook! Yntreq lezu:
    languageButton: 'Hayeren', // TODO: Հdelay

    // Patient registration
    enterName: 'Khndrum enq grel dzez anun (Anun Azganun):', // TODO: Replace with Armenian script
    sharePhone: 'Khndrum enq kisvatsnel dzez herakhosy:', // TODO: Replace with Armenian script
    sharePhoneButton: '📱 Kisvatsnel herakhosy', // TODO: Replace with Armenian script
    skipPhone: 'Bats toel', // TODO: Replace with Armenian script

    // Service selection
    chooseService: 'Yntreq tsarrayutyuny:', // TODO: Replace with Armenian script
    otherService: '🔹 Ayl', // TODO: Replace with Armenian script
    enterCustomReason: 'Nkaragreq dzez aytselutyuny:', // TODO: Replace with Armenian script

    // Date and time selection
    chooseDate: 'Yntreq amsativ:', // TODO: Replace with Armenian script
    chooseTime: 'Yntreq zham:', // TODO: Replace with Armenian script
    noSlots: 'Ayt ory azat slotner chkan. Khndrum enq yntreq urarishy.', // TODO: Replace with Armenian script

    // Booking confirmation
    confirmBooking: 'Hastateq granchum?', // TODO: Replace with Armenian script
    service: 'Tsarrayutyun', // TODO: Replace with Armenian script
    dateTime: 'Amsativ u zham', // TODO: Replace with Armenian script
    yes: '✅ Hastatiel', // TODO: Replace with Armenian script
    no: '❌ Cheghel', // TODO: Replace with Armenian script
    back: '◀️ Het', // TODO: Replace with Armenian script

    // After booking
    bookingConfirmed: '✅ Dzez granchumy stacvats e! Bzhishky piti hastati ayn.', // TODO: Replace with Armenian script
    waitConfirmation: 'Spasum enq bzhishki hastatman...', // TODO: Replace with Armenian script

    // Appointment status notifications
    appointmentConfirmed: '✅ Dzez granchumy hastatvats e!\n\n👨‍⚕️ Bzhishk: Dr. {doctorName}\n📅 {dateTime}', // TODO: Replace with Armenian script
    appointmentRejected: '❌ Dzez granchumy merjvats e.\n\nPatchar: {reason}', // TODO: Replace with Armenian script
    
    // Cancellation messages
    cancelledByDoctor: '❌ Dzez granchumy chegharkvats e bzhishki koghmits.', // TODO: Replace with Armenian script
    reason: 'Patchar', // TODO: Replace with Armenian script
    rebookMessage: 'Khndrum enq grancvek nor zhami.', // TODO: Replace with Armenian script

    // Doctor notifications
    newDoctor: '👨‍⚕️ Nor granchum harcum:\n\nPacient: {patientName}\nTsarrayutyun: {service}\nAmset: {dateTime}\n\nSteghtsek gortsoghutyan:', // TODO: Replace with Armenian script
    confirm: '✅ Hastatiel', // TODO: Replace with Armenian script
    reject: '❌ Merjel', // TODO: Replace with Armenian script
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
