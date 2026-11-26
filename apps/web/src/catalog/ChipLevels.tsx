const toggle = (values: readonly string[], value: string) =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

/**
 * Presentational: the levels of an axis that is a plain list (genres, formats). Any number of
 * them can be taken, and each tap applies at once.
 */
export function ChipLevels(props: {
  label: string;
  // Undefined while they load.
  options: readonly { value: string; label: string }[] | undefined;
  selected: readonly string[];
  loadingText?: string;
  hint: string;
  onChange: (selected: string[]) => void;
}) {
  const { options, selected } = props;
  return (
    <fieldset className="chip-levels" aria-label={props.label}>
      <div className="chips">
        {options === undefined && <span className="chip-levels__hint">{props.loadingText}</span>}
        {options?.map((option) => (
          <button
            key={option.value}
            type="button"
            className="chip chip--level"
            aria-pressed={selected.includes(option.value)}
            onClick={() => props.onChange(toggle(selected, option.value))}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="chip-levels__hint">{props.hint}</p>
    </fieldset>
  );
}
