import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED_BY_DOCTOR';

interface StatusBadgeProps {
  status: AppointmentStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { t } = useLanguage();

  const statusConfig = {
    PENDING: {
      label: t('appointment.pending'),
      className: 'bg-pending/10 text-pending border-pending/30',
    },
    CONFIRMED: {
      label: t('appointment.confirmed'),
      className: 'bg-success/10 text-success border-success/30',
    },
    REJECTED: {
      label: t('appointment.rejected'),
      className: 'bg-destructive/10 text-destructive border-destructive/30',
    },
    CANCELLED_BY_DOCTOR: {
      label: t('appointment.cancelled'),
      className: 'bg-destructive/10 text-destructive border-destructive/30',
    },
  };

  const config = statusConfig[status];

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
