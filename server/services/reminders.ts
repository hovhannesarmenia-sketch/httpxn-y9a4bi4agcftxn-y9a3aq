import cron from 'node-cron';
import { storage } from '../storage';
import { sendTelegramMessage } from './telegram';

export function startReminderService() {
  console.log('[Reminders] Starting appointment reminder service...');
  
  cron.schedule('0 * * * *', async () => {
    console.log('[Reminders] Running hourly reminder check...');
    await sendUpcomingAppointmentReminders();
  });
  
  console.log('[Reminders] Reminder service started - runs every hour');
}

async function sendUpcomingAppointmentReminders() {
  try {
    const doctors = await storage.getAllDoctors();
    
    for (const doctor of doctors) {
      if (!doctor.telegramBotToken) continue;
      
      const now = new Date();
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const in23Hours = new Date(now.getTime() + 23 * 60 * 60 * 1000);
      
      const appointments = await storage.getAppointments(doctor.id, in23Hours, in24Hours);
      
      for (const appointment of appointments) {
        if (appointment.status === 'CANCELLED_BY_DOCTOR' || appointment.status === 'REJECTED') {
          continue;
        }
        
        const patient = await storage.getPatient(appointment.patientId);
        if (!patient || !patient.telegramUserId) continue;
        
        const alreadySent = await storage.hasReminderBeenSent(appointment.id, 'BEFORE_24H');
        if (alreadySent) continue;
        
        const lang = patient.language || 'RU';
        const service = appointment.serviceId ? await storage.getService(appointment.serviceId) : null;
        const serviceName = service ? (lang === 'ARM' ? service.nameArm : service.nameRu) : '';
        
        const appointmentTime = appointment.startDateTime.toLocaleTimeString('ru-RU', { 
          hour: '2-digit', 
          minute: '2-digit',
          timeZone: 'Asia/Yerevan'
        });
        const appointmentDate = appointment.startDateTime.toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          timeZone: 'Asia/Yerevan'
        });
        
        const reminderText = lang === 'ARM' 
          ? `\u0540\u056B\u0577\u0565\u0581\u0576\u0578\u0582\u0574! \u0541\u0565\u0580 \u0563\u0580\u0561\u0576\u0581\u0578\u0582\u0574\u0568 \u057E\u0561\u0572\u0568 \u0567:\n${appointmentDate} ${appointmentTime}\n${serviceName ? `\u053E\u0561\u057C\u0561\u0575\u0578\u0582\u0569\u0575\u0578\u0582\u0576: ${serviceName}` : ''}`
          : `\u041D\u0430\u043F\u043E\u043C\u0438\u043D\u0430\u0435\u043C! \u0412\u0430\u0448\u0430 \u0437\u0430\u043F\u0438\u0441\u044C \u0437\u0430\u0432\u0442\u0440\u0430:\n${appointmentDate} ${appointmentTime}\n${serviceName ? `\u0423\u0441\u043B\u0443\u0433\u0430: ${serviceName}` : ''}`;
        
        try {
          await sendTelegramMessage(doctor.telegramBotToken, patient.telegramUserId, reminderText);
          await storage.createReminderLog(appointment.id, 'BEFORE_24H');
          console.log(`[Reminders] Sent 24h reminder for appointment ${appointment.id}`);
        } catch (err) {
          console.error(`[Reminders] Failed to send reminder for appointment ${appointment.id}:`, err);
        }
      }
    }
  } catch (error) {
    console.error('[Reminders] Error in reminder service:', error);
  }
}
