import React from 'react';

type InputTextareaProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'placeholder' | 'id'
> & {
  id?: string;
  placeholder: string; // teks label
  error?: string; // jika ada -> mode error
  helperText?: string; // teks bantuan di bawah textarea
  showAsterisk?: boolean; // tampilkan bintang walau required=false
  autoGrow?: boolean; // otomatis menyesuaikan tinggi (default: true)
  maxRows?: number; // batasi tinggi saat autoGrow
  showCharCount?: boolean; // tampilkan counter karakter (butuh maxLength agar meaningful)
};

export const InputTextarea = React.forwardRef<HTMLTextAreaElement, InputTextareaProps>(
  (
    {
      id,
      placeholder,
      error,
      helperText,
      className = '',
      rows = 3,
      autoGrow = true,
      maxRows,
      showCharCount = false,
      maxLength,
      showAsterisk,
      ...rest
    },
    ref,
  ) => {
    const autoId = React.useId();
    const areaId = id ?? `ta-${autoId}`;
    const helpId = `${areaId}-help`;
    const hasError = Boolean(error);
    const isRequired = Boolean(rest.required) || Boolean(showAsterisk);

    // local ref to support forwardRef + autoGrow
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null);
    React.useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);

    const resize = React.useCallback(() => {
      const el = innerRef.current;
      if (!el || !autoGrow) return;
      // reset height then set to scrollHeight
      el.style.height = 'auto';
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight || '20');
      const maxPx = maxRows ? maxRows * lineHeight + 16 /* padding guess */ : Infinity;
      const next = Math.min(el.scrollHeight, maxPx);
      el.style.height = `${next}px`;
    }, [autoGrow, maxRows]);

    React.useEffect(() => {
      resize();
    }, [resize, rest.value]); // also when controlled value changes

    const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
      if (autoGrow) resize();
      rest.onInput?.(e as any);
    };

    const baseArea =
      'block w-full rounded-lg bg-transparent appearance-none ' +
      'px-2.5 pb-2.5 pt-5 leading-6 ' +
      'focus:outline-none focus:ring-0 peer ' +
      (hasError
        ? 'border border-chart-5 focus:border-chart-5 '
        : 'border border-muted-foreground/60 ') +
      className;

    // NOTE: label di dalam container relatif (textarea + label) agar posisi stabil
    const labelCls =
      'absolute left-2 top-2 z-10 origin-[0] px-2 pointer-events-none select-none ' +
      'duration-300 transform ' +
      '-translate-y-4 scale-95 ' +
      (hasError ? 'text-chart-5 ' : 'text-foreground/50 ') +
      'bg-background ' +
      // Saat kosong (letakkan dulu agar bisa ditimpa oleh focus/value)
      'peer-placeholder-shown:top-6 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100 ' +
      // Saat sudah ada value
      'peer-[&:not(:placeholder-shown)]:top-2 ' +
      'peer-[&:not(:placeholder-shown)]:-translate-y-4 ' +
      'peer-[&:not(:placeholder-shown)]:scale-80 ' +
      // Saat fokus (taruh paling akhir)
      'peer-focus:top-2 peer-focus:-translate-y-4 peer-focus:scale-80';

    // character count (optional)
    const valueLen =
      typeof rest.value === 'string'
        ? rest.value.length
        : typeof rest.defaultValue === 'string'
          ? rest.defaultValue.length
          : 0;

    return (
      <div>
        {/* container relatif untuk textarea + label */}
        <div className="relative">
          <textarea
            ref={innerRef}
            id={areaId}
            rows={rows}
            className={baseArea}
            placeholder=" " // penting untuk :placeholder-shown
            aria-invalid={hasError || undefined}
            aria-describedby={helperText || error ? helpId : undefined}
            aria-required={isRequired || undefined}
            maxLength={maxLength}
            onInput={handleInput}
            {...rest}
          />
          <label htmlFor={areaId} className={labelCls}>
            {placeholder}
            {isRequired && (
              <>
                <span
                  aria-hidden="true"
                  className={hasError ? 'text-chart-5' : 'text-accent-foreground'}
                >
                  {' '}
                  *
                </span>
                <span className="sr-only"> (required)</span>
              </>
            )}
          </label>
        </div>

        {/* helper / error */}
        {(helperText || error || (showCharCount && maxLength)) && (
          <div className="mt-2 flex items-start justify-between gap-2">
            <p
              id={helpId}
              className={'text-sm ' + (hasError ? 'text-chart-5' : 'text-muted-foreground')}
            >
              {hasError ? error : helperText}
            </p>
            {showCharCount && maxLength != null && (
              <p className="text-sm text-muted-foreground">
                {valueLen}/{maxLength}
              </p>
            )}
          </div>
        )}
      </div>
    );
  },
);
InputTextarea.displayName = 'TextAreaFloating';
