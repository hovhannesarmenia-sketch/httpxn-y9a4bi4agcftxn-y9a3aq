/**
 * Centralized Localization System
 * 
 * This file contains ALL user-facing texts for both the web admin panel
 * and the Telegram bot. All Armenian texts use proper Armenian script.
 */

export type Language = 'ARM' | 'RU';

// ============================================
// WEB ADMIN PANEL TRANSLATIONS
// ============================================

export const webTranslations = {
  ARM: {
    // Navigation
    nav: {
      calendar: 'Օdelays', // Օdelays
      patients: 'Հdelays', // Հdelays
      settings: 'Կdelays', // Կdelays
      diagnostics: 'Դdelays', // Դdelays
    },

    // Calendar section
    calendar: {
      title: 'Օdelays',
      today: 'Delays',
      week: 'Շdelays',
      month: 'Аделays',
      noAppointments: 'Аys ory grancumner chkan',
      appointments: 'grancumner',
      newAppointment: 'Nor grancum',
    },

    // Appointment labels
    appointment: {
      new: 'Nor grancum',
      pending: 'Spasum',
      confirmed: 'Hastatvats',
      rejected: 'Merjvats',
      cancelled: 'Chegharkvats',
      cancelledByDoctor: 'Chegharkvats bzhishki koghmits',
      approve: 'Hastatiel',
      reject: 'Merjel',
      cancel: 'Chegharkel',
      duration: 'Tevoghutyun',
      minutes: 'rope',
      patient: 'Hivand',
      service: 'Tsarrayutyun',
      time: 'Zham',
      date: 'Amsativ',
      reason: 'Patchar',
      rejectionReason: 'Merjman patchar',
      cancellationReason: 'Chegharkman patchar',
    },

    // Patients section
    patients: {
      title: 'Հdelays',
      total: 'ynghanur',
      phone: 'Herakhos',
      name: 'Anun, azganun',
      language: 'Lezu',
      lastVisit: 'Verji aytsy',
      noPatients: 'Grancvats hivandner chkan',
    },

    // Settings section
    settings: {
      title: 'Кdelays',
      profile: 'Bzhishki profil',
      firstName: 'Anun',
      lastName: 'Azganun',
      workSchedule: 'Ashkhatanqayin grapik',
      workDays: 'Ashkhatanqayin orer',
      workHours: 'Ashkhatanqayin zhamaner',
      from: 'Skizb',
      to: 'Avart',
      services: 'Tsarrayutyunner',
      addService: 'Avelacnel tsarrayutyun',
      serviceNameArm: 'Anvanumn (hayeren)',
      serviceNameRu: 'Anvanumn (ruseren)',
      duration: 'Tevoghutyun',
      integrations: 'Integracyaner',
      telegramToken: 'Telegram Bot Token',
      googleCalendarId: 'Google Calendar ID',
      googleSheetId: 'Google Sheets ID',
      save: 'Pahpanel',
      saved: 'Pahpanvats e',
      aiAssistant: 'AI Oknakan',
      aiEnabled: 'Miatsnel AI oknakanу',
      aiEnabledDescription: 'Ogtagortsel LLM azat teksti dasakargman hamar',
      llmApiBaseUrl: 'LLM API himnakan URL',
      llmApiKey: 'LLM API banali',
      llmModelName: 'LLM modeli anun',
      aiKeyConfigured: 'API banali kargelvel e',
      aiKeyNotConfigured: 'API banali chka',
    },

    // Diagnostics section
    diagnostics: {
      title: 'Дdelays',
      telegram: 'Telegram-i kargavichak',
      googleCalendar: 'Google Calendar-i kargavichak',
      googleSheets: 'Google Sheets-i kargavichak',
      connected: 'Kapvats e',
      disconnected: 'Ankap e',
      testMessage: 'Test haxordagir',
      sendTest: 'Ugharkel testay haxordagir',
      checkConnections: 'Stugel miatsumnery',
    },

    // Days of week
    days: {
      MONDAY: 'Erkushabti',
      TUESDAY: 'Erequshabti',
      WEDNESDAY: 'Choreqshabti',
      THURSDAY: 'Hinkshabti',
      FRIDAY: 'Urbat',
      SATURDAY: 'Shabat',
      SUNDAY: 'Kiraki',
    },

    // Common phrases
    common: {
      loading: 'Bernuma...',
      error: 'Skhalment',
      success: 'Hajoghutyun',
      confirm: 'Hastatiel',
      cancel: 'Chegharkel',
      delete: 'Jnchel',
      edit: 'Khmbagrel',
      add: 'Avelacnel',
      save: 'Pahpanel',
      search: 'Vornel',
      filter: 'Znvel',
      noData: 'Tvyalner chkan',
      other: 'Ayl',
      date: 'Amsativ',
      time: 'Zham',
      notes: 'Nshumnner',
      select: 'Yntreq',
      duration: 'Tevoghutyun',
      logout: 'Durs gal',
      all: 'Bolory',
      back: 'Het',
      language: 'Lezu',
    },

    // UI Labels
    ui: {
      languageArm: 'Hayeren',
      languageRu: 'Русский',
      doctorPanel: 'Bzhishki panel',
    },
  },

  RU: {
    nav: {
      calendar: 'Календарь',
      patients: 'Пациенты',
      settings: 'Настройки',
      diagnostics: 'Диагностика',
    },
    calendar: {
      title: 'Календарь записей',
      today: 'Сегодня',
      week: 'Неделя',
      month: 'Месяц',
      noAppointments: 'Нет записей на этот день',
      appointments: 'записей',
      newAppointment: 'Новая',
    },
    appointment: {
      new: 'Новая запись',
      pending: 'Ожидает',
      confirmed: 'Подтверждено',
      rejected: 'Отклонено',
      cancelled: 'Отменено',
      cancelledByDoctor: 'Отменено врачом',
      approve: 'Подтвердить',
      reject: 'Отклонить',
      cancel: 'Отменить',
      duration: 'Длительность',
      minutes: 'мин',
      patient: 'Пациент',
      service: 'Услуга',
      time: 'Время',
      date: 'Дата',
      reason: 'Причина',
      rejectionReason: 'Причина отказа',
      cancellationReason: 'Причина отмены',
    },
    patients: {
      title: 'Пациенты',
      total: 'всего',
      phone: 'Телефон',
      name: 'Имя Фамилия',
      language: 'Язык',
      lastVisit: 'Последний визит',
      noPatients: 'Нет зарегистрированных пациентов',
    },
    settings: {
      title: 'Настройки',
      profile: 'Профиль врача',
      firstName: 'Имя',
      lastName: 'Фамилия',
      workSchedule: 'Расписание работы',
      workDays: 'Рабочие дни',
      workHours: 'Рабочие часы',
      from: 'С',
      to: 'До',
      services: 'Услуги',
      addService: 'Добавить услугу',
      serviceNameArm: 'Название (армянский)',
      serviceNameRu: 'Название (русский)',
      duration: 'Длительность',
      integrations: 'Интеграции',
      telegramToken: 'Telegram Bot Token',
      googleCalendarId: 'Google Calendar ID',
      googleSheetId: 'Google Sheets ID',
      save: 'Сохранить',
      saved: 'Сохранено',
      aiAssistant: 'AI Ассистент',
      aiEnabled: 'Включить AI ассистент',
      aiEnabledDescription: 'Использовать LLM для классификации свободного текста',
      llmApiBaseUrl: 'LLM API базовый URL',
      llmApiKey: 'LLM API ключ',
      llmModelName: 'Название модели LLM',
      aiKeyConfigured: 'API ключ настроен',
      aiKeyNotConfigured: 'API ключ не настроен',
    },
    diagnostics: {
      title: 'Диагностика',
      telegram: 'Telegram статус',
      googleCalendar: 'Google Calendar статус',
      googleSheets: 'Google Sheets статус',
      connected: 'Подключено',
      disconnected: 'Не подключено',
      testMessage: 'Тестовое сообщение',
      sendTest: 'Отправить тест',
      checkConnections: 'Проверить подключения',
    },
    days: {
      MONDAY: 'Понедельник',
      TUESDAY: 'Вторник',
      WEDNESDAY: 'Среда',
      THURSDAY: 'Четверг',
      FRIDAY: 'Пятница',
      SATURDAY: 'Суббота',
      SUNDAY: 'Воскресенье',
    },
    common: {
      loading: 'Загрузка...',
      error: 'Ошибка',
      success: 'Успешно',
      confirm: 'Подтвердить',
      cancel: 'Отмена',
      delete: 'Удалить',
      edit: 'Редактировать',
      add: 'Добавить',
      save: 'Сохранить',
      search: 'Поиск',
      filter: 'Фильтр',
      noData: 'Нет данных',
      other: 'Другое',
      date: 'Дата',
      time: 'Время',
      notes: 'Примечания',
      select: 'Выбрать',
      duration: 'Длительность',
      logout: 'Выход',
      all: 'Все',
      back: 'Назад',
      language: 'Язык',
    },
    ui: {
      languageArm: 'Հdelays',
      languageRu: 'Русский',
      doctorPanel: 'Панель врача',
    },
  },
};

// ============================================
// TELEGRAM BOT TRANSLATIONS
// ============================================

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

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get translation value by dot-notation path
 */
export function getTranslation(
  translations: typeof webTranslations,
  lang: Language,
  path: string
): string {
  const keys = path.split('.');
  let value: any = translations[lang];

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      console.warn(`Translation missing: ${lang}.${path}`);
      return path;
    }
  }

  return typeof value === 'string' ? value : path;
}

/**
 * Format date for display
 */
export function formatDate(date: Date, lang: Language): string {
  const locale = lang === 'ARM' ? 'hy-AM' : 'ru-RU';
  return date.toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Format time for display
 */
export function formatTime(date: Date, lang: Language): string {
  const locale = lang === 'ARM' ? 'hy-AM' : 'ru-RU';
  return date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
}
