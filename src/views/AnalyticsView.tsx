import { useMemo } from 'react';
import { Empty } from '../components/Empty';
import { Icon } from '../components/Icon';
import {
  DAY_LABELS,
  addDays,
  formatWeekRange,
  startOfWeek,
  toKey,
  today,
} from '../lib/date';
import {
  completionMap,
  completionsByDay,
  completionsInRange,
  currentStreak,
  productivityByMain,
  statsForWeek,
  weeksBack,
} from '../lib/selectors';
import { useData } from '../lib/store';

/** Deliberately small: four numbers, two bar charts, no chart library. */
export function AnalyticsView() {
  const { data } = useData();
  const map = useMemo(() => completionMap(data), [data]);
  const now = today();
  const weekStart = useMemo(() => startOfWeek(now), [now]);

  const weekStats = useMemo(() => statsForWeek(data, map, weekStart), [data, map, weekStart]);
  const streak = useMemo(() => currentStreak(data, map), [data, map]);
  const perDay = useMemo(() => completionsByDay(data, weekStart), [data, weekStart]);
  const peakDay = Math.max(1, ...perDay);

  const thisWeekTotal = useMemo(
    () => completionsInRange(data, weekStart, addDays(weekStart, 6)),
    [data, weekStart],
  );
  const monthStart = useMemo(() => new Date(now.getFullYear(), now.getMonth(), 1), [now]);
  const monthEnd = useMemo(() => new Date(now.getFullYear(), now.getMonth() + 1, 0), [now]);
  const thisMonthTotal = useMemo(
    () => completionsInRange(data, monthStart, monthEnd),
    [data, monthStart, monthEnd],
  );

  const trend = useMemo(() => {
    const starts = weeksBack(8);
    return starts.map((start) => ({
      start,
      label: formatWeekRange(start).split(' – ')[0],
      count: completionsInRange(data, start, addDays(start, 6)),
    }));
  }, [data]);
  const peakTrend = Math.max(1, ...trend.map((entry) => entry.count));

  const byMain = useMemo(
    () => productivityByMain(data, monthStart, monthEnd),
    [data, monthStart, monthEnd],
  );
  const peakMain = Math.max(1, ...byMain.map((entry) => entry.count));
  const todayKeyValue = toKey(now);

  const hasData = thisMonthTotal > 0 || thisWeekTotal > 0;

  return (
    <div className="view view--pad scroll">
      <div className="view-head">
        <div>
          <h1 className="view-title">Analytics</h1>
          <p className="view-sub">Week of {formatWeekRange(weekStart)}</p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="card">
          <div className="card__label">Completed this week</div>
          <div className="card__value">{thisWeekTotal}</div>
          <div className="card__hint">task-days ticked</div>
        </div>
        <div className="card">
          <div className="card__label">Completed this month</div>
          <div className="card__value">{thisMonthTotal}</div>
          <div className="card__hint">task-days ticked</div>
        </div>
        <div className="card">
          <div className="card__label">Completion rate</div>
          <div className="card__value">{weekStats.percent}%</div>
          <div className="bar" style={{ marginTop: 8 }}>
            <div className="bar__fill" style={{ width: `${weekStats.percent}%` }} />
          </div>
          <div className="card__hint" style={{ marginTop: 4 }}>
            {weekStats.completed} of {weekStats.total} scheduled days
          </div>
        </div>
        <div className="card">
          <div className="card__label">Current streak</div>
          <div className="card__value" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Icon name="flame" size={18} />
            {streak}
          </div>
          <div className="card__hint">{streak === 1 ? 'day' : 'days'} in a row</div>
        </div>
      </div>

      {!hasData ? (
        <div className="card">
          <Empty
            icon="analytics"
            text="Tick a few days off and your productivity history will build up here."
            pad
          />
        </div>
      ) : (
        <>
          <div className="grid-2">
            <div className="card">
              <div className="card__head">
                <h2 className="card__title">Daily completion</h2>
                <span className="chip">This week</span>
              </div>
              <div className="chart">
                {perDay.map((count, index) => {
                  const key = toKey(addDays(weekStart, index));
                  return (
                    <div className="chart__col" key={key}>
                      <span className="chart__value">{count || ''}</span>
                      <span className="chart__track">
                        <span
                          className={
                            key > todayKeyValue ? 'chart__bar chart__bar--muted' : 'chart__bar'
                          }
                          style={{ height: `${Math.round((count / peakDay) * 100)}%` }}
                        />
                      </span>
                      <span
                        className={
                          key === todayKeyValue ? 'chart__label chart__label--today' : 'chart__label'
                        }
                      >
                        {DAY_LABELS[index]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card">
              <div className="card__head">
                <h2 className="card__title">Eight-week trend</h2>
                <span className="chip">Completions per week</span>
              </div>
              <div className="chart">
                {trend.map((entry, index) => (
                  <div className="chart__col" key={toKey(entry.start)}>
                    <span className="chart__value">{entry.count || ''}</span>
                    <span className="chart__track">
                      <span
                        className={
                          index === trend.length - 1 ? 'chart__bar' : 'chart__bar chart__bar--muted'
                        }
                        style={{ height: `${Math.round((entry.count / peakTrend) * 100)}%` }}
                      />
                    </span>
                    <span className="chart__label">{entry.label}</span>
                  </div>
                ))}
              </div>
              <div className="legend" style={{ marginTop: 8 }}>
                <span className="legend__key">
                  <span className="legend__swatch" style={{ background: 'var(--green)' }} />
                  Current week
                </span>
                <span className="legend__key">
                  <span
                    className="legend__swatch"
                    style={{ background: 'color-mix(in srgb, var(--green) 45%, var(--bg))' }}
                  />
                  Earlier weeks
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card__head">
              <h2 className="card__title">Category productivity</h2>
              <span className="chip">This month</span>
            </div>
            {byMain.length === 0 ? (
              <Empty icon="folder" text="No main categories yet." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {byMain.map(({ main, count }) => (
                  <div className="hbar" key={main.id}>
                    <span className="hbar__name">
                      {main.icon} {main.name}
                    </span>
                    <span className="bar">
                      <span
                        className="bar__fill"
                        style={{ width: `${Math.round((count / peakMain) * 100)}%` }}
                      />
                    </span>
                    <span className="hbar__value">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
