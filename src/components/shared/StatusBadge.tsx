interface StatusBadgeProps {
  value: number;
  thresholds?: { good: number; warning: number };
  labels?: { good: string; warning: string; critical: string };
  invert?: boolean; // true for metrics where lower is better (e.g., disease risk)
}

export default function StatusBadge({
  value,
  thresholds = { good: 70, warning: 40 },
  labels = { good: 'Good', warning: 'Warning', critical: 'Critical' },
  invert = false,
}: StatusBadgeProps) {
  let status: 'good' | 'warning' | 'critical';

  if (invert) {
    status = value <= thresholds.warning ? 'good' : value <= thresholds.good ? 'warning' : 'critical';
  } else {
    status = value >= thresholds.good ? 'good' : value >= thresholds.warning ? 'warning' : 'critical';
  }

  const styles = {
    good: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    critical: 'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
        status === 'good' ? 'bg-emerald-500' : status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
      }`} />
      {labels[status]}
    </span>
  );
}
