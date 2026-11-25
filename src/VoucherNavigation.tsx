import { ChevronDown, Ticket } from "lucide-react"
import { Button } from "./ui"
import { voucherPage, voucherPageParams, voucherPages } from "./voucher-navigation"

export default function VoucherNavigation({ active, params, canBrowse = true, debt, open }: {
  active: boolean; params: URLSearchParams; canCreate: boolean;
  canBrowse?: boolean; debt?: { active: boolean; open: () => void };
  open: (patch: Record<string, string | null>) => void;
}) {
  const selected = active ? voucherPage(params).id : null
  return <div className="nav-section" role="group" aria-label="Voucher">
    <Button variant="ghost" className="nav-item nav-section-label" aria-label="Voucher" title="Voucher" onClick={() => canBrowse ? open(voucherPageParams("sources")) : debt?.open()}>
      <Ticket size={18} /><span>Voucher</span><ChevronDown size={14} />
    </Button>
    <div className="subnav">{canBrowse && voucherPages.map((page) => <Button key={page.id} variant="ghost"
      className={`subnav-item ${selected === page.id ? "active" : ""}`} aria-current={selected === page.id ? "page" : undefined}
      onClick={() => open(voucherPageParams(page.id))}>
      <span>{page.title}</span>{selected === page.id && <span className="active-dot" />}
    </Button>)}
      {debt && !canBrowse && <Button variant="ghost" className={`subnav-item ${debt.active ? "active" : ""}`} aria-current={debt.active ? "page" : undefined} onClick={debt.open}>
        <span>Công nợ voucher</span>{debt.active && <span className="active-dot" />}
      </Button>}
    </div>
  </div>
}
