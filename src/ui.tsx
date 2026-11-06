import { createElement, useEffect, useRef } from "react"
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  HTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  FormHTMLAttributes,
  TextareaHTMLAttributes,
  Ref,
} from "react"
import { ChevronDown, X } from "lucide-react"

interface SelectOption {
  value: string
  label: string
}
export function Button({
  className = "",
  variant = "default",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "ghost" | "link"
}) {
  return createElement("button", {
    type: "button",
    ...props,
    className: `button button-${variant} ${className}`,
  })
}
export function Input(
  props: InputHTMLAttributes<HTMLInputElement> & {
    ref?: Ref<HTMLInputElement>
  },
) {
  if (props.type === "date") {
    const value = String(props.value || "")
    return (
      <div className={`input date-input ${props.className || ""}`}>
        <span aria-hidden="true">
          {value ? value.split("-").reverse().join("/") : "dd/mm/yyyy"}
        </span>
        {createElement("input", {
          ...props,
          className: "native-date",
          lang: "vi-VN",
          onClick: (event: React.MouseEvent<HTMLInputElement>) => {
            props.onClick?.(event)
            try {
              event.currentTarget.showPicker?.()
            } catch {
              /* Native keyboard entry remains available. */
            }
          },
        })}
      </div>
    )
  }
  return createElement("input", {
    ...props,
    className: `input ${props.className || ""}`,
  })
}
export function Select({
  options,
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  options: Array<string | SelectOption>
}) {
  return (
    <div className={`select-wrap ${className}`}>
      {createElement(
        "select",
        { ...props, className: "input" },
        options.map((o) =>
          createElement(
            "option",
            {
              key: typeof o === "string" ? o : o.value,
              value: typeof o === "string" ? o : o.value,
            },
            typeof o === "string" ? o : o.label,
          ),
        ),
      )}
      <ChevronDown size={14} />
    </div>
  )
}
export function Heading({
  level = 2,
  ...props
}: HTMLAttributes<HTMLHeadingElement> & { level?: 1 | 2 | 3 }) {
  return createElement(`h${level}`, props)
}
export function Label(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return createElement("label", props)
}
export function Form(props: FormHTMLAttributes<HTMLFormElement>) {
  return createElement("form", {
    ...props,
    onKeyDown: (event: React.KeyboardEvent<HTMLFormElement>) => {
      props.onKeyDown?.(event)
      if (
        event.key === "Enter" &&
        !event.nativeEvent.isComposing &&
        (event.target as HTMLElement).tagName === "INPUT"
      ) {
        event.preventDefault()
        event.currentTarget.requestSubmit()
      }
    },
  })
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return createElement("textarea", {
    ...props,
    className: `input textarea ${props.className || ""}`,
  })
}
export function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <Label className={`field ${error ? "field-error" : ""}`}>
      <span className="field-label">
        {label}
        {required && <span className="required"> *</span>}
      </span>
      {children}
      {error ? (
        <span className="field-message">{error}</span>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </Label>
  )
}
export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: string
  children: ReactNode
}) {
  return (
    <span className={`badge badge-${tone}`}>
      <span className="status-dot" />
      {children}
    </span>
  )
}
export function Overlay({
  title,
  subtitle,
  children,
  footer,
  onClose,
  wide = false,
  drawer = false,
  dismissOnBackdrop = true,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
  wide?: boolean
  drawer?: boolean
  dismissOnBackdrop?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement
    const first =
      ref.current?.querySelector<HTMLElement>("input, select, textarea") ||
      ref.current?.querySelector<HTMLElement>("button")
    first?.focus()
    function key(e: KeyboardEvent) {
      const dialogs = document.querySelectorAll(".dialog")
      if (dialogs[dialogs.length - 1] !== ref.current) return
      if (e.key === "Escape") closeRef.current()
      if (e.key === "Tab") {
        const nodes = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
          ) || [],
        )
        const first = nodes[0],
          last = nodes[nodes.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        }
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener("keydown", key)
    return () => {
      document.removeEventListener("keydown", key)
      previous?.focus()
    }
  }, [])
  return (
    <div
      className={`overlay ${drawer ? "overlay-drawer" : ""}`}
      onMouseDown={(e) => {
        if (dismissOnBackdrop && e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={ref}
        className={`dialog ${wide ? "dialog-wide" : ""} ${
          drawer ? "drawer" : ""
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="dialog-header">
          <div>
            <Heading>{title}</Heading>
            {subtitle && (
              <div className="muted dialog-subtitle">{subtitle}</div>
            )}
          </div>
          <Button variant="ghost" aria-label="Đóng" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-footer">{footer}</div>}
      </div>
    </div>
  )
}
