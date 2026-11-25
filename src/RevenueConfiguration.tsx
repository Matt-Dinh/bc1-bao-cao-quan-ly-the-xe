import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { History, Info, Pencil, Plus, Power } from "lucide-react"
import { Badge, Button, Field, Form, Heading, Input, Overlay, Select, Textarea } from "./ui"
import { date, estates, fmt, normalize } from "./data"
import { allowedSites, displayTime, isDay, parkingVehicles, shiftDay, siteById, vnToday } from "./parking-model"
import { allOption, ExportButton, NoMatches, TextLink } from "./parking-ui"
import { auditRevenue, configAt, dateCell, estateName, policyTypes, revenueWrite } from "./revenue-model"
import type { Config, Policy } from "./revenue-model"
import { isPositiveMoney, referencePattern } from "./revenue-operations"
import { PagedData, ReasonDialog } from "./RevenueOperations"
import type { RevenueOperationProps } from "./RevenueOperations"
import { DataTable } from "./RevenueDashboard"
import LookupFilterPanel, { lookupMatchHint } from "./LookupFilterPanel"
import CardLookupMultiFilter from "./CardLookupMultiFilter"

type Draft =
  | { type: "policy"; value: Policy; original?: Policy }
  | { type: "config"; value: Config; original: Config }

const policyStatuses = ["Hoạt động", "Sắp áp dụng", "Hết hiệu lực", "Ngưng hoạt động"] as const
const sapStatuses = ["Đã đầy đủ", "Chưa đầy đủ"] as const
const splitParam = (value: string | null) => (value ? value.split("|").filter(Boolean) : [])

const statusOf = (policy: Policy, day = vnToday()) => {
  if (!policy.active) return "Ngưng hoạt động"
  if (policy.until && day > policy.until) return "Hết hiệu lực"
  if (policy.from > day) return "Sắp áp dụng"
  return "Hoạt động"
}

const formatPolicyValue = (policy: Policy) => {
  if (policy.kind === policyTypes[0]) return "—"
  if (policy.kind === policyTypes[1]) return `${fmt(policy.value)} giờ`
  if (policy.kind === policyTypes[2]) return `${policy.value}%`
  return `${fmt(policy.value)} đ`
}

const sapComplete = (config: Config) =>
  Boolean(config.mall.trim() && config.company.trim() && config.branch.trim() && config.customer.trim())

const auditFieldLabels: Record<string, string> = {
  code: "Mã chính sách",
  name: "Tên chính sách",
  kind: "Cách tính",
  value: "Giá trị",
  order: "Thứ tự",
  payer: "Bên chịu chi phí",
  vehicle: "Phương tiện",
  from: "Áp dụng từ",
  until: "Đến ngày",
  active: "Trạng thái",
  sites: "Bãi áp dụng",
  note: "Mô tả",
  hour: "Giờ bắt đầu ngày doanh thu",
  vat: "Thuế suất VAT",
  vatFrom: "VAT áp dụng từ",
  overdue: "Ngưỡng quá hạn",
  mall: "Mã TTTM",
  company: "Mã công ty",
  branch: "Mã chi nhánh",
  customer: "Mã khách hàng",
}

function formatAuditField(key: string, value: unknown): string {
  if (value === undefined || value === null || value === "") {
    if (key === "vehicle") return "Tất cả"
    if (key === "until") return "Vô thời hạn"
    return "Chưa khai báo"
  }
  if (key === "active") return value ? "Hoạt động" : "Ngưng hoạt động"
  if (key === "from" || key === "until" || key === "vatFrom") return date(String(value))
  if (key === "vat") return `${value}%`
  if (key === "overdue") return `${value} ngày`
  if (key === "sites" && Array.isArray(value)) {
    return value.length ? value.map((id) => siteById(String(id))?.label ?? String(id)).join(", ") : "Tất cả bãi"
  }
  return String(value)
}

function renderAuditDetail(detail: string): ReactNode {
  try {
    const parsed = JSON.parse(detail) as {
      before?: Record<string, unknown>
      after?: Record<string, unknown>
      reason?: string
    }
    if (!parsed || typeof parsed !== "object" || (!parsed.before && !parsed.after)) {
      return <span className="muted">{detail}</span>
    }
    const keys = Object.keys(auditFieldLabels).filter(
      (key) => (parsed.before && key in parsed.before) || (parsed.after && key in parsed.after),
    )
    const changes = parsed.before && parsed.after
      ? keys.filter((key) => JSON.stringify(parsed.before?.[key]) !== JSON.stringify(parsed.after?.[key]))
      : keys.filter((key) => parsed.after?.[key] !== undefined && parsed.after?.[key] !== "")
    return (
      <>
        {changes.map((key) => (
          <div key={key}>
            <span className="muted">{auditFieldLabels[key]}:</span>{" "}
            {parsed.before ? (
              <>
                {formatAuditField(key, parsed.before[key])} → <strong>{formatAuditField(key, parsed.after?.[key])}</strong>
              </>
            ) : (
              <strong>{formatAuditField(key, parsed.after?.[key])}</strong>
            )}
          </div>
        ))}
        {parsed.reason && (
          <div>
            <span className="muted">Lý do:</span> {parsed.reason}
          </div>
        )}
      </>
    )
  } catch {
    return <span className="muted">{detail}</span>
  }
}

export function RevenueConfiguration({
  policies,
  state,
  ledger,
  access,
  params,
  update,
  actor,
  save,
  notify,
  exportFile,
  onDirty,
  headerActions,
}: RevenueOperationProps & {
  policies: boolean
  onDirty: (dirty: boolean) => void
  headerActions?: (actions: ReactNode) => ReactNode
}) {
  const sites = allowedSites(access)
  const permitted = estates.filter((item) => sites.some((site) => site.estate === item.id))
  const editable = revenueWrite(access, policies ? "policy" : "settings")
  const [draft, setDraft] = useState<Draft | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [discard, setDiscard] = useState(false)
  const [error, setError] = useState("")
  const [siteSearch, setSiteSearch] = useState("")
  const [toggle, setToggle] = useState<Policy | null>(null)
  const [scopeNotice, setScopeNotice] = useState("")

  const today = vnToday()
  const tomorrow = shiftDay(today, 1)

  const applied = {
    q: params.get("q")?.slice(0, 100) || "",
    estates: splitParam(params.get("estate")),
    sites: splitParam(params.get("site")),
    vehicles: splitParam(params.get("vehicle")),
    statuses: splitParam(params.get("policyStatus")),
    kinds: splitParam(params.get("policyKind")),
    sap: splitParam(params.get("sapStatus")),
  }
  const appliedSignature = JSON.stringify(applied)
  const [filterDraft, setFilterDraft] = useState(applied)
  useEffect(() => {
    setFilterDraft(JSON.parse(appliedSignature))
    setScopeNotice("")
  }, [appliedSignature])

  const pendingFilters = JSON.stringify(filterDraft) !== appliedSignature

  const applyFilters = (next = filterDraft) =>
    update({
      q: next.q || null,
      estate: next.estates.length ? next.estates.join("|") : null,
      site: next.sites.length ? next.sites.join("|") : null,
      vehicle: next.vehicles.length ? next.vehicles.join("|") : null,
      policyStatus: next.statuses.length ? next.statuses.join("|") : null,
      policyKind: next.kinds.length ? next.kinds.join("|") : null,
      sapStatus: next.sap.length ? next.sap.join("|") : null,
      page: null,
    })

  const clearFilters = () => {
    const empty = {
      q: "",
      estates: [] as string[],
      sites: [] as string[],
      vehicles: [] as string[],
      statuses: [] as string[],
      kinds: [] as string[],
      sap: [] as string[],
    }
    setFilterDraft(empty)
    setScopeNotice("")
    applyFilters(empty)
  }

  const close = () => {
    setDraft(null)
    onDirty(false)
    setDiscard(false)
    setError("")
  }

  const startPolicy = (value?: Policy) => {
    setError("")
    setSiteSearch("")
    setDraft({
      type: "policy",
      value: value ?? {
        code: "",
        name: "",
        kind: policyTypes[0],
        value: 0,
        order: state.policies.length + 1,
        from: today,
        until: "",
        sites: [],
        vehicle: "",
        payer: "VCR",
        note: "",
        active: true,
      },
      original: value,
    })
  }

  const config = (estate: string) =>
    state.configs.find((row) => row.estate === estate) ?? configAt(state, estate, today)

  const startConfig = (estate: string) => {
    setError("")
    const original = config(estate)
    setDraft({ type: "config", value: { ...original }, original })
  }

  const updateDraft = (change: Partial<Policy> | Partial<Config>) => {
    if (!draft) return
    setDraft({ ...draft, value: { ...draft.value, ...change } } as Draft)
    onDirty(true)
  }

  const dirty = !!draft && JSON.stringify(draft.value) !== JSON.stringify(draft.original)
  const closeEditor = () => {
    if (dirty) setDiscard(true)
    else close()
  }

  const policyScoped = (row: Policy) =>
    !access.estate || !row.sites.length || row.sites.some((id) => sites.some((site) => site.id === id))

  const policyEditable = (row: Policy) =>
    editable && (!access.estate || (row.sites.length > 0 && row.sites.every((id) => sites.some((site) => site.id === id))))

  const saveConfig = () => {
    if (!draft || !editable || (draft.original && !dirty)) return
    if (draft.type === "policy") {
      const original = draft.original
      const value: Policy = {
        ...draft.value,
        code: draft.value.code.trim().toUpperCase(),
        name: draft.value.name.trim(),
        value: draft.value.kind === policyTypes[0] ? 0 : draft.value.value,
        note: draft.value.note.trim(),
      }
      const validAmount =
        value.kind === policyTypes[0] ||
        (isPositiveMoney(value.value) &&
          (value.kind !== policyTypes[1] || value.value <= 24) &&
          (value.kind !== policyTypes[2] || value.value <= 100))
      if (
        !referencePattern.test(value.code) ||
        !value.name ||
        !validAmount ||
        !isPositiveMoney(value.order) ||
        !isDay(value.from) ||
        (value.until && (!isDay(value.until) || value.until < value.from)) ||
        (value.payer !== "VCR" && !value.payer.trim()) ||
        (access.estate && !value.sites.length) ||
        value.sites.some((id) => !sites.some((site) => site.id === id))
      ) {
        setError("Kiểm tra mã, tên, giá trị, thứ tự, phạm vi và ngày hiệu lực của chính sách.")
        return
      }
      if (
        save((latest) => {
          if (latest.policies.some((row) => row.code === value.code && row.code !== original?.code))
            throw new Error("Mã chính sách đã tồn tại.")
          if (original && JSON.stringify(latest.policies.find((row) => row.code === original.code)) !== JSON.stringify(original))
            throw new Error("Chính sách đã được cập nhật.")
          return auditRevenue(
            { ...latest, policies: [value, ...latest.policies.filter((row) => row.code !== original?.code)] },
            actor,
            original ? "Sửa chính sách" : "Thêm chính sách",
            access.estate,
            JSON.stringify({ before: original, after: value }),
          )
        })
      ) {
        close()
        notify("Đã lưu chính sách.")
      }
      return
    }
    const original = draft.original
    const value: Config = {
      ...draft.value,
      mall: draft.value.mall.trim(),
      company: draft.value.company.trim(),
      branch: draft.value.branch.trim(),
      customer: draft.value.customer.trim(),
    }
    const hourChanged = value.hour !== original.hour || value.from !== original.from
    const vatChanged = value.vat !== original.vat || value.vatFrom !== original.vatFrom
    if (
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.hour) ||
      (hourChanged && (!isDay(value.from) || value.from < tomorrow)) ||
      (vatChanged && (!isDay(value.vatFrom) || value.vatFrom < tomorrow)) ||
      !Number.isFinite(value.vat) ||
      value.vat < 0 ||
      value.vat > 100 ||
      !Number.isInteger(value.overdue) ||
      value.overdue < 1 ||
      value.overdue > 365 ||
      ![value.mall, value.company, value.branch, value.customer].every((item) => referencePattern.test(item))
    ) {
      setError("Kiểm tra giờ bắt đầu, ngày hiệu lực từ ngày mai, VAT, ngưỡng quá hạn và mã SAP.")
      return
    }
    if (
      save((latest) => {
        if (JSON.stringify(latest.configs.find((row) => row.estate === value.estate)) !== JSON.stringify(original))
          throw new Error("Cấu hình đã được cập nhật.")
        return auditRevenue(
          { ...latest, configs: [value, ...latest.configs] },
          actor,
          "Sửa cấu hình doanh thu",
          value.estate,
          JSON.stringify({ before: original, after: value }),
        )
      })
    ) {
      close()
      notify("Đã lưu cấu hình doanh thu.")
    }
  }

  const policyData = (row: Policy) => ({
    "Mã chính sách": row.code,
    "Tên chính sách": row.name,
    "Cách tính": row.kind,
    "Giá trị": formatPolicyValue(row),
    "Thứ tự": row.order,
    "Bên chịu chi phí": row.payer,
    "Bãi áp dụng": row.sites.length ? row.sites.map((id) => siteById(id)?.label).join(", ") : "Tất cả bãi",
    "Phương tiện": row.vehicle || "Tất cả",
    "Từ ngày": dateCell(row.from),
    "Đến ngày": row.until ? dateCell(row.until) : "Vô thời hạn",
    "Trạng thái": statusOf(row, today),
    "Thao tác": "",
  })

  const configData = (row: Config) => ({
    "Khu đô thị": estateName(row.estate),
    "Giờ bắt đầu": row.hour,
    "Áp dụng từ": dateCell(row.from),
    "VAT (%)": `${row.vat}%`,
    "VAT áp dụng từ": dateCell(row.vatFrom),
    "Ngưỡng quá hạn": `${row.overdue} ngày`,
    "Mã TTTM": row.mall || "Chưa khai báo",
    "Công ty": row.company || "Chưa khai báo",
    "Chi nhánh": row.branch || "Chưa khai báo",
    "Mã khách hàng": row.customer || "Chưa khai báo",
    "Thao tác": "",
  })

  const policyRows = state.policies
    .filter((row) => {
      if (!policyScoped(row)) return false
      const q = normalize(applied.q)
      if (q && !normalize(`${row.code} ${row.name} ${row.payer}`).includes(q)) return false
      if (applied.statuses.length && !applied.statuses.includes(statusOf(row, today))) return false
      if (applied.kinds.length && !applied.kinds.includes(row.kind)) return false
      if (applied.estates.length && row.sites.length && !row.sites.some((id) => applied.estates.includes(siteById(id)?.estate ?? "")))
        return false
      if (applied.sites.length && row.sites.length && !row.sites.some((id) => applied.sites.includes(id))) return false
      if (applied.vehicles.length && row.vehicle && !applied.vehicles.includes(row.vehicle)) return false
      return true
    })
    .sort((a, b) => a.order - b.order)

  const configRows = permitted
    .map((item) => config(item.id))
    .filter((row) => {
      const estateMeta = estates.find((item) => item.id === row.estate)
      const q = normalize(applied.q)
      if (q && !normalize(`${estateMeta?.name ?? ""} ${estateMeta?.code ?? ""} ${row.mall} ${row.company} ${row.branch} ${row.customer}`).includes(q))
        return false
      if (applied.estates.length && !applied.estates.includes(row.estate)) return false
      if (applied.sap.length) {
        const status = sapComplete(row) ? "Đã đầy đủ" : "Chưa đầy đủ"
        if (!applied.sap.includes(status)) return false
      }
      return true
    })

  const historyRows = state.audit.filter(
    (row) =>
      (!access.estate || !row.scope || row.scope === access.estate) &&
      (!applied.estates.length || !row.scope || applied.estates.includes(row.scope)) &&
      (policies ? row.action.includes("chính sách") : row.action === "Sửa cấu hình doanh thu"),
  )

  const hasActiveFilters = Boolean(
    applied.q ||
      applied.estates.length ||
      applied.sites.length ||
      applied.vehicles.length ||
      applied.statuses.length ||
      applied.kinds.length ||
      applied.sap.length,
  )

  const filteredSites = sites.filter(
    (site) => !filterDraft.estates.length || filterDraft.estates.includes(site.estate),
  )

  const actionsNode = (
    <>
      <ExportButton
        onClick={() =>
          exportFile(policies ? "ChinhSachMienGiam" : "CauHinhDoanhThu", () => ({
            [policies ? "Chính sách" : "Cấu hình"]: policies
              ? policyRows.map(policyData)
              : configRows.map(configData),
          }))
        }
      />
      {policies && editable && (
        <Button variant="primary" onClick={() => startPolicy()}>
          <Plus size={15} /> Thêm mới
        </Button>
      )}
    </>
  )

  const valueLabel =
    draft?.type === "policy"
      ? draft.value.kind === policyTypes[1]
        ? "Số giờ miễn (1–24 giờ)"
        : draft.value.kind === policyTypes[2]
          ? "Tỷ lệ giảm (1–100%)"
          : "Số tiền giảm (đ)"
      : "Giá trị"

  const valueMax =
    draft?.type === "policy"
      ? draft.value.kind === policyTypes[1]
        ? 24
        : draft.value.kind === policyTypes[2]
          ? 100
          : undefined
      : undefined

  return (
    <>
      {headerActions?.(actionsNode)}
      <div className="settings-info">
        <Info size={16} />
        <span>
          {policies
            ? "Chính sách miễn / giảm áp dụng theo thứ tự ưu tiên từ nhỏ đến lớn. Khi không chọn bãi cụ thể, chính sách áp dụng cho tất cả bãi trong phạm vi."
            : "Cấu hình doanh thu được thiết lập theo từng khu đô thị. Thay đổi giờ bắt đầu ngày doanh thu và thuế suất VAT chỉ áp dụng từ ngày hiệu lực, không làm thay đổi dữ liệu đã chốt."}
        </span>
      </div>

      {policies ? (
        <LookupFilterPanel
          label="Bộ lọc Chính sách miễn / giảm"
          pending={pendingFilters}
          onApply={() => applyFilters()}
          onClear={clearFilters}
        >
          <div className="filter-grid lookup-filter-primary">
            <Field label="Tìm kiếm">
              <Input
                type="search"
                aria-label="Tìm chính sách"
                maxLength={100}
                placeholder="Mã chính sách, tên chính sách, bên chịu chi phí…"
                value={filterDraft.q}
                onChange={(e) => setFilterDraft((prev) => ({ ...prev, q: e.target.value }))}
              />
            </Field>
            <CardLookupMultiFilter
              label="Trạng thái"
              value={filterDraft.statuses}
              allLabel="Tất cả trạng thái"
              options={policyStatuses.map((value) => ({ value, label: value }))}
              onChange={(statuses) => setFilterDraft((prev) => ({ ...prev, statuses }))}
            />
          </div>
          <div className="filter-grid lookup-filter-row">
            <CardLookupMultiFilter
              label="Khu đô thị"
              value={filterDraft.estates}
              allLabel="Tất cả khu đô thị"
              options={permitted.map((item) => ({ value: item.id, label: item.name }))}
              onChange={(estates) => {
                const keptSites = filterDraft.sites.filter((id) =>
                  sites.some((site) => site.id === id && (!estates.length || estates.includes(site.estate))),
                )
                setScopeNotice(
                  keptSites.length !== filterDraft.sites.length
                    ? "Đã bỏ các bãi xe không thuộc khu đô thị vừa chọn. Vui lòng kiểm tra lại trước khi áp dụng."
                    : "",
                )
                setFilterDraft((prev) => ({ ...prev, estates, sites: keptSites }))
              }}
            />
            <CardLookupMultiFilter
              label="Bãi xe"
              value={filterDraft.sites}
              allLabel="Tất cả bãi xe"
              options={filteredSites.map((site) => ({ value: site.id, label: site.label }))}
              onChange={(sites) => setFilterDraft((prev) => ({ ...prev, sites }))}
            />
            <CardLookupMultiFilter
              label="Phương tiện"
              value={filterDraft.vehicles}
              allLabel="Tất cả phương tiện"
              options={parkingVehicles.map((value) => ({ value, label: value }))}
              onChange={(vehicles) => setFilterDraft((prev) => ({ ...prev, vehicles }))}
            />
            <CardLookupMultiFilter
              label="Cách tính"
              value={filterDraft.kinds}
              allLabel="Tất cả cách tính"
              options={policyTypes.map((value) => ({ value, label: value }))}
              onChange={(kinds) => setFilterDraft((prev) => ({ ...prev, kinds }))}
            />
          </div>
          <p className="lookup-multi-hint">{lookupMatchHint}</p>
          {scopeNotice && (
            <p className="lookup-multi-notice" role="status">
              {scopeNotice}
            </p>
          )}
        </LookupFilterPanel>
      ) : (
        <LookupFilterPanel
          label="Bộ lọc Cấu hình doanh thu"
          pending={pendingFilters}
          onApply={() => applyFilters()}
          onClear={clearFilters}
        >
          <div className="filter-grid config-filter-grid">
            <Field label="Tìm kiếm">
              <Input
                type="search"
                aria-label="Tìm cấu hình doanh thu"
                maxLength={100}
                placeholder="Tên khu đô thị, mã TTTM, mã SAP…"
                value={filterDraft.q}
                onChange={(e) => setFilterDraft((prev) => ({ ...prev, q: e.target.value }))}
              />
            </Field>
            <CardLookupMultiFilter
              label="Khu đô thị"
              value={filterDraft.estates}
              allLabel="Tất cả khu đô thị"
              options={permitted.map((item) => ({ value: item.id, label: item.name }))}
              onChange={(estates) => setFilterDraft((prev) => ({ ...prev, estates }))}
            />
            <CardLookupMultiFilter
              label="Khai báo SAP"
              value={filterDraft.sap}
              allLabel="Tất cả trạng thái SAP"
              options={sapStatuses.map((value) => ({ value, label: value }))}
              onChange={(sap) => setFilterDraft((prev) => ({ ...prev, sap }))}
            />
          </div>
          <p className="lookup-multi-hint">{lookupMatchHint}</p>
        </LookupFilterPanel>
      )}

      <section className="panel">
        <div className="op-table-toolbar lookup-table-toolbar">
          <div className="lookup-result-summary">
            <span className="count-text" aria-live="polite">
              <strong>{fmt(policies ? policyRows.length : configRows.length)}</strong>{" "}
              {policies ? "chính sách" : "khu đô thị"}
            </span>
          </div>
          <Button onClick={() => setShowHistory(true)}>
            <History size={15} /> Lịch sử thay đổi
            {historyRows.length > 0 && <span className="tab-counter">{historyRows.length}</span>}
          </Button>
        </div>
        {policies ? (
          <PagedData
            rows={policyRows}
            id={(row) => row.code}
            data={policyData}
            params={params}
            update={update}
            empty={hasActiveFilters ? <NoMatches clear={clearFilters} /> : "Chưa có chính sách miễn / giảm"}
            link={(row, key) => {
              if (key === "Trạng thái") {
                const stateLabel = statusOf(row, today)
                return (
                  <Badge
                    tone={
                      stateLabel === "Hoạt động"
                        ? "green"
                        : stateLabel === "Sắp áp dụng"
                          ? "amber"
                          : "neutral"
                    }
                  >
                    {stateLabel}
                  </Badge>
                )
              }
              if (key === "Mã chính sách" && policyEditable(row)) {
                return <TextLink onClick={() => startPolicy(row)}>{row.code}</TextLink>
              }
              if (key === "Thao tác") {
                return policyEditable(row) ? (
                  <div className="op-row-actions">
                    <Button
                      variant="ghost"
                      title="Sửa chính sách"
                      aria-label={`Sửa ${row.code}`}
                      onClick={() => startPolicy(row)}
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      title={row.active ? "Ngưng hoạt động" : "Hoạt động lại"}
                      aria-label={`${row.active ? "Ngưng hoạt động" : "Hoạt động lại"} ${row.code}`}
                      onClick={() => setToggle(row)}
                    >
                      <Power size={14} />
                    </Button>
                  </div>
                ) : (
                  "—"
                )
              }
              return undefined
            }}
          />
        ) : (
          <DataTable
            rows={configRows}
            rowKey={(row) => row.estate}
            data={configData}
            empty={hasActiveFilters ? <NoMatches clear={clearFilters} /> : "Chưa có cấu hình doanh thu"}
            link={(row, key) => {
              if (["Mã TTTM", "Công ty", "Chi nhánh", "Mã khách hàng"].includes(key)) {
                const value =
                  key === "Mã TTTM"
                    ? row.mall
                    : key === "Công ty"
                      ? row.company
                      : key === "Chi nhánh"
                        ? row.branch
                        : row.customer
                return value ? value : <span className="muted">Chưa khai báo</span>
              }
              if (key === "Thao tác") {
                return editable ? (
                  <div className="op-row-actions">
                    <Button
                      variant="ghost"
                      title="Sửa cấu hình doanh thu"
                      aria-label={`Sửa ${estateName(row.estate)}`}
                      onClick={() => startConfig(row.estate)}
                    >
                      <Pencil size={14} />
                    </Button>
                  </div>
                ) : (
                  "—"
                )
              }
              return undefined
            }}
          />
        )}
      </section>

      {draft && (
        <Overlay
          wide={draft.type === "policy"}
          title={
            draft.type === "policy"
              ? draft.original
                ? `Sửa chính sách · ${draft.original.code}`
                : "Thêm chính sách miễn / giảm"
              : `Sửa cấu hình doanh thu · ${estateName(draft.value.estate)}`
          }
          subtitle={
            draft.type === "policy"
              ? "Thiết lập điều kiện áp dụng, cách tính và thời gian hiệu lực của chính sách."
              : "Thay đổi giờ bắt đầu ngày doanh thu và VAT chỉ áp dụng từ ngày hiệu lực."
          }
          onClose={closeEditor}
          footer={
            <>
              <Button onClick={closeEditor}>Hủy</Button>
              <Button
                type="submit"
                form="revenue-config-form"
                variant="primary"
                disabled={!!draft.original && !dirty}
              >
                {draft.original ? "Lưu thay đổi" : "Thêm mới"}
              </Button>
            </>
          }
        >
          <Form
            id="revenue-config-form"
            onSubmit={(e) => {
              e.preventDefault()
              saveConfig()
            }}
          >
            {draft.type === "policy" ? (
              <>
                <div className="detail-section-heading">
                  <Heading level={3}>Thông tin và cách tính</Heading>
                </div>
                <div className="parking-form-grid">
                  <Field label="Mã chính sách" required>
                    <Input
                      autoFocus
                      maxLength={255}
                      value={draft.value.code}
                      disabled={
                        !!draft.original &&
                        ledger.some((row) => row.discounts.some((item) => item.code === draft.original?.code))
                      }
                      onChange={(e) => updateDraft({ code: e.target.value })}
                    />
                  </Field>
                  <Field label="Tên chính sách" required>
                    <Input
                      maxLength={255}
                      value={draft.value.name}
                      onChange={(e) => updateDraft({ name: e.target.value })}
                    />
                  </Field>
                  <Field label="Cách tính" required>
                    <Select
                      value={draft.value.kind}
                      options={[...policyTypes]}
                      onChange={(e) =>
                        updateDraft({
                          kind: e.target.value,
                          value: e.target.value === policyTypes[0] ? 0 : draft.value.value,
                        })
                      }
                    />
                  </Field>
                  {draft.value.kind !== policyTypes[0] && (
                    <Field label={valueLabel} required>
                      <Input
                        type="number"
                        min={1}
                        max={valueMax}
                        value={draft.value.value || ""}
                        onChange={(e) => updateDraft({ value: Number(e.target.value) })}
                      />
                    </Field>
                  )}
                  <Field label="Thứ tự áp dụng" required>
                    <Input
                      type="number"
                      min={1}
                      value={draft.value.order || ""}
                      onChange={(e) => updateDraft({ order: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="Bên chịu chi phí" required>
                    <Input
                      maxLength={255}
                      value={draft.value.payer}
                      onChange={(e) => updateDraft({ payer: e.target.value })}
                    />
                  </Field>
                </div>
                <div className="detail-section-heading mt-5">
                  <Heading level={3}>Phạm vi và hiệu lực</Heading>
                </div>
                <div className="parking-form-grid">
                  <Field label="Phương tiện">
                    <Select
                      value={draft.value.vehicle}
                      options={[allOption("Tất cả phương tiện"), ...parkingVehicles]}
                      onChange={(e) => updateDraft({ vehicle: e.target.value })}
                    />
                  </Field>
                  <Field label="Trạng thái">
                    <Select
                      value={draft.value.active ? "Hoạt động" : "Ngưng hoạt động"}
                      options={["Hoạt động", "Ngưng hoạt động"]}
                      onChange={(e) => updateDraft({ active: e.target.value === "Hoạt động" })}
                    />
                  </Field>
                  <Field label="Từ ngày" required>
                    <Input
                      type="date"
                      value={draft.value.from}
                      onChange={(e) => updateDraft({ from: e.target.value })}
                    />
                  </Field>
                  <Field label="Đến ngày" hint="Để trống nếu vô thời hạn.">
                    <Input
                      type="date"
                      min={draft.value.from}
                      value={draft.value.until}
                      onChange={(e) => updateDraft({ until: e.target.value })}
                    />
                  </Field>
                  <div className="op-full">
                    <Field
                      label="Bãi áp dụng"
                      hint={access.estate ? "Chọn các bãi được phân quyền." : "Để trống để áp dụng tất cả bãi."}
                    >
                      <Input
                        type="search"
                        placeholder="Tìm bãi xe…"
                        value={siteSearch}
                        onChange={(e) => setSiteSearch(e.target.value)}
                      />
                    </Field>
                    <div className="parking-inline mt-2">
                      {sites
                        .filter((site) => normalize(site.label).includes(normalize(siteSearch)))
                        .map((site) => (
                          <label key={site.id} className="revenue-toggle">
                            <input
                              type="checkbox"
                              checked={draft.value.sites.includes(site.id)}
                              onChange={(e) =>
                                updateDraft({
                                  sites: e.target.checked
                                    ? [...draft.value.sites, site.id]
                                    : draft.value.sites.filter((id) => id !== site.id),
                                })
                              }
                            />
                            {site.label}
                          </label>
                        ))}
                    </div>
                  </div>
                  <div className="op-full">
                    <Field label="Mô tả">
                      <Textarea
                        rows={3}
                        maxLength={500}
                        value={draft.value.note}
                        onChange={(e) => updateDraft({ note: e.target.value })}
                      />
                      <span className="character-count">{draft.value.note.length}/500</span>
                    </Field>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="detail-section-heading">
                  <Heading level={3}>Ngày doanh thu, thuế và công nợ</Heading>
                </div>
                <div className="parking-form-grid">
                  <Field label="Giờ bắt đầu ngày doanh thu" required>
                    <Input
                      autoFocus
                      type="time"
                      value={draft.value.hour}
                      onChange={(e) =>
                        updateDraft({
                          hour: e.target.value,
                          from: draft.value.from < tomorrow ? tomorrow : draft.value.from,
                        })
                      }
                    />
                  </Field>
                  <Field label="Áp dụng từ ngày" required>
                    <Input
                      type="date"
                      min={tomorrow}
                      value={draft.value.from}
                      onChange={(e) => updateDraft({ from: e.target.value })}
                    />
                  </Field>
                  <Field label="Thuế suất VAT (%)" required>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={Number.isNaN(draft.value.vat) ? "" : draft.value.vat}
                      onChange={(e) =>
                        updateDraft({
                          vat: e.target.value === "" ? NaN : Number(e.target.value),
                          vatFrom: draft.value.vatFrom < tomorrow ? tomorrow : draft.value.vatFrom,
                        })
                      }
                    />
                  </Field>
                  <Field label="VAT áp dụng từ ngày" required>
                    <Input
                      type="date"
                      min={tomorrow}
                      value={draft.value.vatFrom}
                      onChange={(e) => updateDraft({ vatFrom: e.target.value })}
                    />
                  </Field>
                  <Field label="Ngưỡng quá hạn công nợ (ngày)" required>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={draft.value.overdue}
                      onChange={(e) => updateDraft({ overdue: Number(e.target.value) })}
                    />
                  </Field>
                </div>
                <div className="detail-section-heading mt-5">
                  <Heading level={3}>Mã SAP</Heading>
                </div>
                <div className="parking-form-grid">
                  {(
                    [
                      ["mall", "Mã TTTM"],
                      ["company", "Mã công ty"],
                      ["branch", "Mã chi nhánh"],
                      ["customer", "Mã khách hàng"],
                    ] as const
                  ).map(([key, label]) => (
                    <Field key={key} label={label} required>
                      <Input
                        maxLength={255}
                        value={draft.value[key]}
                        onChange={(e) => updateDraft({ [key]: e.target.value })}
                      />
                    </Field>
                  ))}
                </div>
              </>
            )}
            {error && (
              <div className="parking-banner error mt-4" role="alert">
                {error}
              </div>
            )}
          </Form>
        </Overlay>
      )}

      {discard && (
        <Overlay
          title="Bạn có thay đổi chưa lưu"
          onClose={() => setDiscard(false)}
          dismissOnBackdrop={false}
          footer={
            <>
              <Button autoFocus onClick={() => setDiscard(false)}>
                Ở lại
              </Button>
              <Button variant="primary" onClick={close}>
                Bỏ thay đổi
              </Button>
            </>
          }
        >
          Rời đi sẽ mất các thay đổi này.
        </Overlay>
      )}

      {showHistory && (
        <Overlay
          drawer
          title="Lịch sử thay đổi"
          subtitle={
            policies
              ? "Các thay đổi chính sách miễn / giảm."
              : "Các thay đổi cấu hình doanh thu theo khu đô thị."
          }
          onClose={() => setShowHistory(false)}
          footer={<Button onClick={() => setShowHistory(false)}>Đóng</Button>}
        >
          {historyRows.length ? (
            historyRows.map((row, index) => (
              <div className="parking-history-entry" key={index}>
                <strong>
                  {row.action}
                  {row.scope ? ` · ${estateName(row.scope)}` : ""}
                </strong>
                <span>
                  {row.actor} · {displayTime(row.at)}
                </span>
                {renderAuditDetail(row.detail)}
              </div>
            ))
          ) : (
            <div className="parking-empty">Chưa có thay đổi</div>
          )}
        </Overlay>
      )}

      {toggle && (
        <ReasonDialog
          title={toggle.active ? "Ngưng hoạt động" : "Hoạt động lại"}
          description={`${toggle.code} · ${toggle.name}`}
          action="Xác nhận"
          close={() => setToggle(null)}
          submit={(reason) => {
            if (
              save((latest) => {
                const current = latest.policies.find((row) => row.code === toggle.code)
                if (!current || current.active !== toggle.active || !policyEditable(current))
                  throw new Error("Chính sách đã thay đổi.")
                const value = { ...current, active: !current.active }
                return auditRevenue(
                  { ...latest, policies: latest.policies.map((row) => (row.code === current.code ? value : row)) },
                  actor,
                  value.active ? "Bật chính sách" : "Ngưng chính sách",
                  access.estate,
                  JSON.stringify({ before: current, after: value, reason }),
                )
              })
            ) {
              setToggle(null)
              notify("Đã cập nhật chính sách.")
            }
          }}
        />
      )}
    </>
  )
}
