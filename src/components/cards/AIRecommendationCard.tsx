import { useTranslation } from 'react-i18next';

interface AIRecommendationCardProps {
  title: string;
  confidence: string;
  text: string;
  factors: { label: string; value: number }[];
  onSimulate: () => void;
  onAccept: () => void;
  onDismiss: () => void;
}

export function AIRecommendationCard({
  title,
  confidence,
  text,
  factors,
  onSimulate,
  onAccept,
  onDismiss,
}: AIRecommendationCardProps) {
  const { t } = useTranslation();

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
        <span className="badge">{confidence}</span>
      </div>

      <p className="text-[13px] text-ice-dim leading-relaxed mb-4" dangerouslySetInnerHTML={{ __html: text }} />

      <div className="space-y-2.5 mb-4">
        {factors.map((factor) => (
          <div key={factor.label} className="factor">
            <div className="flex justify-between text-[12px] text-ice-dim mb-1">
              <span>{factor.label}</span>
              <span className="text-ice" style={{ fontVariantNumeric: 'tabular-nums' }}>{factor.value}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-[#eef1f5] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#1f3a5f]"
                style={{ width: `${factor.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap pt-1">
        <button className="btn ghost" onClick={onSimulate}>
          {t('common.simulate')}
        </button>
        <button className="btn primary" onClick={onAccept}>
          {t('common.accept')}
        </button>
        <button className="btn ghost" onClick={onDismiss}>
          {t('common.dismiss')}
        </button>
      </div>
    </div>
  );
}
