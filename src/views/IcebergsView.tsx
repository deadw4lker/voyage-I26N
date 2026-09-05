import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { Badge } from '../components/ui/Badge';
import { BergTrajectoryChart } from '../components/charts/BergTrajectoryChart';
import type { IcebergData } from '../types';

const icebergsData: IcebergData[] = [
  { id: 'B-42', class: 'Large Tabular', position: '66.8°S 44.1°E', drift: '0.6 kn SW', risk: 82, confidence: 94, distance: 4.2 },
  { id: 'E-33', class: 'Growler', position: '65.6°S 45.5°E', drift: '0.5 kn NW', risk: 55, confidence: 88, distance: 9.4 },
  { id: 'C-19', class: 'Medium', position: '65.9°S 46.7°E', drift: '0.3 kn S', risk: 41, confidence: 90, distance: 11.8 },
  { id: 'A-81', class: 'Small', position: '67.2°S 47.9°E', drift: '0.4 kn SE', risk: 12, confidence: 97, distance: 26.5 },
  { id: 'D-07', class: 'Medium', position: '66.1°S 43.0°E', drift: '0.2 kn W', risk: 9, confidence: 91, distance: 31.0 },
  { id: 'F-11', class: 'Very Large', position: '67.8°S 46.2°E', drift: '0.1 kn S', risk: 6, confidence: 96, distance: 38.7 },
];

function riskLabel(risk: number): string {
  if (risk >= 60) return 'High';
  if (risk >= 30) return 'Medium';
  return 'Low';
}

export function IcebergsView() {
  const { t } = useTranslation();
  const [selectedIceberg, setSelectedIceberg] = useState<IcebergData>(icebergsData[0]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4">
        <div className="panel">
          <div className="panel-head">
            <h2>{t('icebergs.title')}</h2>
            <span className="hint">{t('icebergs.hint')}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="tbl w-full" role="grid" aria-label={t('icebergs.title')}>
              <thead>
                <tr>
                  <th scope="col">{t('icebergs.table.id')}</th>
                  <th scope="col">{t('icebergs.table.class')}</th>
                  <th scope="col">{t('icebergs.table.position')}</th>
                  <th scope="col">{t('icebergs.table.drift')}</th>
                  <th scope="col">{t('icebergs.table.risk')}</th>
                  <th scope="col">{t('icebergs.table.distance')}</th>
                </tr>
              </thead>
              <tbody>
                {icebergsData.map((berg) => (
                  <tr
                    key={berg.id}
                    className={cn('cursor-pointer', selectedIceberg.id === berg.id && 'selected')}
                    onClick={() => setSelectedIceberg(berg)}
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedIceberg(berg); } }}
                    role="button"
                    aria-pressed={selectedIceberg.id === berg.id}
                  >
                    <td className="text-ice font-medium">{berg.id}</td>
                    <td className="text-ice-dim">{berg.class}</td>
                    <td className="text-ice" style={{ fontVariantNumeric: 'tabular-nums' }}>{berg.position}</td>
                    <td className="text-ice-dim" style={{ fontVariantNumeric: 'tabular-nums' }}>{berg.drift}</td>
                    <td>
                      <span className="text-[12.5px] text-ice" style={{ fontVariantNumeric: 'tabular-nums' }}>{berg.risk}% · {riskLabel(berg.risk)}</span>
                    </td>
                    <td className="text-ice" style={{ fontVariantNumeric: 'tabular-nums' }}>{berg.distance.toFixed(1)} nm</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="panel">
            <div className="panel-head">
              <h2 id="bergDetailTitle">
                {selectedIceberg.id} — {selectedIceberg.class}
              </h2>
              <Badge id="bergDetailRisk">
                {selectedIceberg.risk}% {t('icebergs.detail.risk').replace('% risk', '')}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-3.5 gap-x-4.5">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-ice-faint">{t('icebergs.detail.detected')}</span>
                <span className="text-[13px] text-ice">Sentinel-1 SAR</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-ice-faint">{t('icebergs.detail.confidence')}</span>
                <span className="text-[13px] text-ice" id="bergDetailConf" style={{ fontVariantNumeric: 'tabular-nums' }}>{selectedIceberg.confidence}%</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-ice-faint">{t('icebergs.detail.distance')}</span>
                <span className="text-[13px] text-ice" id="bergDetailDist" style={{ fontVariantNumeric: 'tabular-nums' }}>{selectedIceberg.distance.toFixed(1)} nm</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-ice-faint">{t('icebergs.detail.lastUpdate')}</span>
                <span className="text-[13px] text-ice-dim">6 min ago</span>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>{t('icebergs.chart.title')}</h2>
            </div>
            <BergTrajectoryChart />
          </div>
        </div>
      </div>
    </div>
  );
}
