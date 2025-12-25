export type Language = 'ARM' | 'RU';

const translationsData = {
  ARM: {
    nav: {
      calendar: 'Օdelays',
      patients: 'Հdelays',
      settings: 'Կարdelay',
      diagnostics: ' Delays',
    },
    calendar: {
      title: 'Delays',
      today: 'Այdelays',
      week: 'Շab',
      month: 'Delays',
      noAppointments: 'Delays delays',
      appointments: 'գdelays',
    },
    appointment: {
      new: 'Նor գrDelays',
      pending: 'Սpasdelays',
      confirmed: 'Հastadelays',
      rejected: 'Мdelays',
      cancelled: 'Чdelays',
      approve: 'Հastatel',
      reject: 'Мerzhel',
      cancel: 'Chgel',
      duration: 'Тevoghutyun',
      minutes: 'ропе',
      patient: 'Hndelays',
      service: 'Сdelays',
      time: 'Жam',
      date: 'Amsativ',
      reason: 'Patchar',
      rejectionReason: 'Мerzhman patchar',
    },
    patients: {
      title: 'Hndelays',
      total: 'yndhanur',
      phone: 'Herakhos',
      name: 'Anun Azganun',
      language: 'Lezu',
      lastVisit: 'Verji aytselutyun',
      noPatients: 'Grnvats hndikarner chkan',
    },
    settings: {
      title: 'Kardelays',
      profile: 'Bzhshki profil',
      firstName: 'Anun',
      lastName: 'Azganun',
      workSchedule: 'Ashkhatanqayin grapik',
      workDays: 'Ashkhatanqayin orer',
      workHours: 'Ashkhatanqayin zhamaner',
      from: 'Skizb',
      to: 'Avart',
      services: 'Sarvagrutyunner',
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
    },
    diagnostics: {
      title: 'Akhtoroshum',
      telegram: 'Telegram kardelay',
      googleCalendar: 'Google Calendar karg',
      googleSheets: 'Google Sheets karg',
      connected: 'Kapvats e',
      disconnected: 'Ankap e',
      testMessage: 'Test haxordagir',
      sendTest: 'Ugharkiel test',
    },
    days: {
      MONDAY: 'Erkushabti',
      TUESDAY: 'Erequshabti',
      WEDNESDAY: 'Choreqshabti',
      THURSDAY: 'Hinkshabti',
      FRIDAY: 'Urbat',
      SATURDAY: 'Shabat',
      SUNDAY: 'Kiraki',
    },
    common: {
      loading: 'Berne...',
      error: 'Skhalment',
      success: 'Hajoghutyun',
      confirm: 'Hastatiel',
      cancel: 'Chgeghtel',
      delete: 'Jnchel',
      edit: 'Khsmel',
      add: 'Avelacnel',
      save: 'Pahpanel',
      search: 'Voroman',
      filter: 'Zinvel',
      noData: 'Tvyalner chkan',
      other: 'Ayl',
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
    },
    appointment: {
      new: 'Новая запись',
      pending: 'Ожидает',
      confirmed: 'Подтверждено',
      rejected: 'Отклонено',
      cancelled: 'Отменено',
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
    },
    diagnostics: {
      title: 'Диагностика',
      telegram: 'Telegram статус',
      googleCalendar: 'Google Calendar статус',
      googleSheets: 'Google Sheets статус',
      connected: 'Подключено',
      disconnected: 'Не подключено',
      testMessage: 'Отправить тестовое сообщение',
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
    },
  },
};

export const translations = translationsData;

export function t(lang: Language, path: string): string {
  const keys = path.split('.');
  let value: any = translations[lang];
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return path;
    }
  }
  
  return typeof value === 'string' ? value : path;
}

export function formatDate(date: Date, lang: Language): string {
  const locale = lang === 'ARM' ? 'hy-AM' : 'ru-RU';
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatTime(date: Date, lang: Language): string {
  const locale = lang === 'ARM' ? 'hy-AM' : 'ru-RU';
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}
