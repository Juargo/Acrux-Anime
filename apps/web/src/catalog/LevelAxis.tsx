import { type Ref, useId } from 'react';
import { useTranslation } from 'react-i18next';

// What the levels of the Anime world can be read by (board M2).
export const AXES = ['era', 'genre', 'format'] as const;
export type Axis = (typeof AXES)[number];

/** Presentational: "Niveles por", the one choice of which levels are in view. */
export function LevelAxis(props: {
  axis: Axis;
  onChange: (axis: Axis) => void;
  groupRef?: Ref<HTMLDivElement>;
}) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className="level-axis" role="radiogroup" aria-labelledby={id} ref={props.groupRef}>
      <span className="level-axis__label" id={id}>
        {t('levels.by')}
      </span>
      <div className="level-axis__options">
        {AXES.map((axis) => (
          <label className="level-axis__option" key={axis}>
            <input
              type="radio"
              name={id}
              value={axis}
              checked={props.axis === axis}
              onChange={() => props.onChange(axis)}
            />
            <span>{t(`levels.${axis}`)}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
