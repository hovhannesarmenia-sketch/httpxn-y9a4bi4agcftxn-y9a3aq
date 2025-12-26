/**
 * Centralized Localization System
 * 
 * This file contains ALL user-facing texts for both the web admin panel
 * and the Telegram bot. All Armenian texts should use proper Armenian script (Հdelays).
 * 
 * IMPORTANT: Do NOT use Latin characters for Armenian text!
 */

export type Language = 'ARM' | 'RU';

// ============================================
// WEB ADMIN PANEL TRANSLATIONS
// ============================================

export const webTranslations = {
  ARM: {
    // Navigation
    nav: {
      calendar: 'Օdelays', // TODO: Replace with proper Armenian
      patients: 'Հdelays', // TODO: Replace with proper Armenian
      settings: 'Կargavordumner', // TODO: Replace with proper Armenian
      diagnostics: 'Ախdelays', // TODO: Replace with proper Armenian
    },

    // Calendar section
    calendar: {
      title: 'Օdelays', // TODO: Replace with proper Armenian
      today: 'Այdelays', // TODO: Replace with proper Armenian
      week: 'Շdelays', // TODO: Replace with proper Armenian
      month: ' Delays', // TODO: Replace with proper Armenian
      noAppointments: 'Այdelays delays unkats e', // TODO: Replace with proper Armenian
      appointments: 'delays', // TODO: Replace with proper Armenian
      newAppointment: 'Նdelays', // TODO: Replace with proper Armenian
    },

    // Appointment labels
    appointment: {
      new: 'Նоделays', // TODO: Replace with proper Armenian
      pending: 'Սպասdelays', // TODO: Replace with proper Armenian
      confirmed: 'Հdelays', // TODO: Replace with proper Armenian
      rejected: 'Мdelays', // TODO: Replace with proper Armenian
      cancelled: 'Չdelays', // TODO: Replace with proper Armenian
      cancelledByDoctor: 'Чdelays bzhishki koghmits', // TODO: Replace with proper Armenian
      approve: 'Հdelays', // TODO: Replace with proper Armenian
      reject: 'Мdelays', // TODO: Replace with proper Armenian
      cancel: 'Чdelays', // TODO: Replace with proper Armenian
      duration: 'Тdelays', // TODO: Replace with proper Armenian
      minutes: 'delays', // TODO: Replace with proper Armenian
      patient: 'Հdelays', // TODO: Replace with proper Armenian
      service: 'Сdelays', // TODO: Replace with proper Armenian
      time: 'Жam', // TODO: Replace with proper Armenian
      date: 'Аmsativ', // TODO: Replace with proper Armenian
      reason: 'Պatchar', // TODO: Replace with proper Armenian
      rejectionReason: 'Мdelays patchar', // TODO: Replace with proper Armenian
      cancellationReason: 'Чdelays patchar', // TODO: Replace with proper Armenian
    },

    // Patients section
    patients: {
      title: 'Հdelays', // TODO: Replace with proper Armenian
      total: 'delays', // TODO: Replace with proper Armenian
      phone: 'Հerakhos', // TODO: Replace with proper Armenian
      name: 'Аdelays Аzganun', // TODO: Replace with proper Armenian
      language: 'Лezu', // TODO: Replace with proper Armenian
      lastVisit: 'Вerji aytselutyun', // TODO: Replace with proper Armenian
      noPatients: 'Grancvats hndikarner chkan', // TODO: Replace with proper Armenian
    },

    // Settings section
    settings: {
      title: 'Кargavordumner', // TODO: Replace with proper Armenian
      profile: 'Бzhishki profil', // TODO: Replace with proper Armenian
      firstName: 'Аnun', // TODO: Replace with proper Armenian
      lastName: 'Аzganun', // TODO: Replace with proper Armenian
      workSchedule: 'Аshkhatanqayin grapik', // TODO: Replace with proper Armenian
      workDays: 'Аshkhatanqayin orer', // TODO: Replace with proper Armenian
      workHours: 'Аshkhatanqayin zhamaner', // TODO: Replace with proper Armenian
      from: 'Skizb', // TODO: Replace with proper Armenian
      to: 'Avart', // TODO: Replace with proper Armenian
      services: 'Сarrayutyunner', // TODO: Replace with proper Armenian
      addService: 'Аvelacnel tsarrayutyun', // TODO: Replace with proper Armenian
      serviceNameArm: 'Anvanumn (delays)', // TODO: Replace with proper Armenian
      serviceNameRu: 'Anvanumn (delays)', // TODO: Replace with proper Armenian
      duration: 'Тevoghutyun', // TODO: Replace with proper Armenian
      integrations: 'Иntegracyaner', // TODO: Replace with proper Armenian
      telegramToken: 'Telegram Bot Token',
      googleCalendarId: 'Google Calendar ID',
      googleSheetId: 'Google Sheets ID',
      save: 'Пahpanel', // TODO: Replace with proper Armenian
      saved: 'Пahpanvats e', // TODO: Replace with proper Armenian
      aiAssistant: 'AI Оknakan', // TODO: Replace with proper Armenian
      aiEnabled: 'Мiatsnel AI oknakanы', // TODO: Replace with proper Armenian
      aiEnabledDescription: 'Оgtagortsel LLM azat teksti dasakargman hamar', // TODO: Replace with proper Armenian
      llmApiBaseUrl: 'LLM API himnakan URL',
      llmApiKey: 'LLM API banali', // TODO: Replace with proper Armenian
      llmModelName: 'LLM modeli anun', // TODO: Replace with proper Armenian
      aiKeyConfigured: 'API banali kargelvel e', // TODO: Replace with proper Armenian
      aiKeyNotConfigured: 'API banali chka', // TODO: Replace with proper Armenian
    },

    // Diagnostics section
    diagnostics: {
      title: 'Аkhtoroshumm', // TODO: Replace with proper Armenian
      telegram: 'Telegram karg', // TODO: Replace with proper Armenian
      googleCalendar: 'Google Calendar karg', // TODO: Replace with proper Armenian
      googleSheets: 'Google Sheets karg', // TODO: Replace with proper Armenian
      connected: 'Кapvats e', // TODO: Replace with proper Armenian
      disconnected: 'Аnkap e', // TODO: Replace with proper Armenian
      testMessage: 'Тест haxordagir', // TODO: Replace with proper Armenian
      sendTest: 'Ugharkiel test', // TODO: Replace with proper Armenian
    },

    // Days of week
    days: {
      MONDAY: 'Еrkushabti', // TODO: Replace with proper Armenian
      TUESDAY: 'Еrequshabti', // TODO: Replace with proper Armenian
      WEDNESDAY: 'Choreqshabti', // TODO: Replace with proper Armenian
      THURSDAY: 'Нinkshabti', // TODO: Replace with proper Armenian
      FRIDAY: 'Urbat', // TODO: Replace with proper Armenian
      SATURDAY: 'Shabat', // TODO: Replace with proper Armenian
      SUNDAY: 'Кiraki', // TODO: Replace with proper Armenian
    },

    // Common phrases
    common: {
      loading: 'Berne...', // TODO: Replace with proper Armenian
      error: 'Skhalment', // TODO: Replace with proper Armenian
      success: 'Hajoghutyun', // TODO: Replace with proper Armenian
      confirm: 'Hastatiel', // TODO: Replace with proper Armenian
      cancel: 'Cheghel', // TODO: Replace with proper Armenian
      delete: 'Jnchel', // TODO: Replace with proper Armenian
      edit: 'Khsmkel', // TODO: Replace with proper Armenian
      add: 'Avelacnel', // TODO: Replace with proper Armenian
      save: 'Pahpanel', // TODO: Replace with proper Armenian
      search: 'Vornel', // TODO: Replace with proper Armenian
      filter: 'Znvel', // TODO: Replace with proper Armenian
      noData: 'Tvyalner chkan', // TODO: Replace with proper Armenian
      other: 'Ayl', // TODO: Replace with proper Armenian
      date: 'Amsativ', // TODO: Replace with proper Armenian
      time: 'Zham', // TODO: Replace with proper Armenian
      notes: 'Nshumnner', // TODO: Replace with proper Armenian
      select: 'Entrequ', // TODO: Replace with proper Armenian
      duration: 'Tevoghutyun', // TODO: Replace with proper Armenian
      logout: 'Elq', // TODO: Replace with proper Armenian
    },

    // UI Labels
    ui: {
      languageArm: 'Հdelays', // TODO: Replace with proper Armenian
      languageRu: 'Русский',
      doctorPanel: 'Bzhishki panel', // TODO: Replace with proper Armenian
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
    },
    ui: {
      languageArm: 'Հայdelays',
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
    welcome: 'Barev dzez MedBook! Yntreq lezu:', // TODO: Replace with proper Armenian
    languageButton: 'Hayeren', // TODO: Replace with proper Armenian

    // Patient registration
    enterName: 'Khndrum enq grel dzez anun (Anun Azganun):', // TODO: Replace with proper Armenian
    sharePhone: 'Khndrum enq kisvatsnel dzez herakhosy:', // TODO: Replace with proper Armenian
    sharePhoneButton: '📱 Kisvatsnel herakhosy', // TODO: Replace with proper Armenian
    skipPhone: 'Bats toel', // TODO: Replace with proper Armenian

    // Service selection
    chooseService: 'Yntreq tsarrayutyuny:', // TODO: Replace with proper Armenian
    otherService: '🔹 Ayl', // TODO: Replace with proper Armenian
    enterCustomReason: 'Nkaragreq dzez aytselutyuny:', // TODO: Replace with proper Armenian

    // Date and time selection
    chooseDate: 'Yntreq amsativ:', // TODO: Replace with proper Armenian
    chooseTime: 'Yntreq zham:', // TODO: Replace with proper Armenian
    noSlots: 'Ayt ory azat slotner chkan. Khndrum enq yntreq urarishy.', // TODO: Replace with proper Armenian

    // Booking confirmation
    confirmBooking: 'Hastateq granchum?', // TODO: Replace with proper Armenian
    service: 'Tsarrayutyun', // TODO: Replace with proper Armenian
    dateTime: 'Amsativ u zham', // TODO: Replace with proper Armenian
    yes: '✅ Hastatiel', // TODO: Replace with proper Armenian
    no: '❌ Cheghel', // TODO: Replace with proper Armenian
    back: '◀️ Het', // TODO: Replace with proper Armenian

    // After booking
    bookingConfirmed: '✅ Dzez granchumy stacvats e! Bzhishky piti hastati ayn.', // TODO: Replace with proper Armenian
    waitConfirmation: 'Spasum enq bzhishki hastatman...', // TODO: Replace with proper Armenian

    // Appointment status notifications
    appointmentConfirmed: '✅ Dzez granchumy hastatvats e!\n\n👨‍⚕️ Bzhishk: Dr. {doctorName}\n📅 {dateTime}', // TODO: Replace with proper Armenian
    appointmentRejected: '❌ Dzez granchumy merjvats e.\n\nPatchar: {reason}', // TODO: Replace with proper Armenian
    appointmentCancelledByDoctor: '❌ Dzez granchumy chegharkvats e bzhishki koghmits.', // TODO: Replace with proper Armenian
    reason: 'Patchar', // TODO: Replace with proper Armenian
    rebookMessage: 'Khndrum enq grancvek nor zhami.', // TODO: Replace with proper Armenian

    // Doctor notifications
    newAppointmentRequest: '👨‍⚕️ Nor granchum harcum:\n\nPacient: {patientName}\nTsarrayutyun: {service}\nAmset: {dateTime}\n\nSteghtsek gortsoghutyan:', // TODO: Replace with proper Armenian
    confirm: '✅ Hastatiel', // TODO: Replace with proper Armenian
    reject: '❌ Merjel', // TODO: Replace with proper Armenian
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
    appointmentCancelledByDoctor: '❌ Ваш приём был отменён врачом.',
    reason: 'Причина',
    rebookMessage: 'Пожалуйста, запишитесь на другое время.',

    // Doctor notifications
    newAppointmentRequest: '👨‍⚕️ Новая запись:\n\nПациент: {patientName}\nУслуга: {service}\nДата: {dateTime}\n\nВыберите действие:',
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
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Format time for display
 */
export function formatTime(date: Date, lang: Language): string {
  const locale = lang === 'ARM' ? 'hy-AM' : 'ru-RU';
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format date for display (short format)
 */
export function formatDateShort(dateStr: string, lang: Language): string {
  const date = new Date(dateStr + 'T00:00:00');
  const locale = lang === 'ARM' ? 'hy-AM' : 'ru-RU';
  return date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
}
