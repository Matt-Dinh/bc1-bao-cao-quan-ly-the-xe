import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { CreditCard, Plus, X } from "lucide-react"
import { Button, Field, Input, Select, Textarea } from "./ui"
import { EntityPicker, RelationChoices } from "./ManagementPickers"
import { estates, normalize, today } from "./data"
import type { Card } from "./data"
import type { OperationState } from "./operations-model"
import {
  assignedCard, controlRequiresPlate, customerSubscriptionGroup, directoryOf, managementParks, registrationInput, registrationForCard,
  subscriberRequiresCard, subscriptionCardFits,
  profileHasFace,profileRequiresFace,profileUsesCard,profileRequiresUhf,profileUsesUhf,profileRfidVehicle,controlMethodKeys,controlMethods,controlDescription,controlRequiresCard,controlRequiresUhf,
} from "./subscription-model"
import type { ControlMethod, ManagedService, SubscriberInput, SubscriptionDirectory } from "./subscription-model"
import { vehicleVariantLabel, vehicleVariantOptions } from "./vehicle-energy"

function Section({number,title,hint,children}:{number:number;title:string;hint?:string;children:ReactNode}) {
  return <section className="sr-section"><div className="sr-section-heading"><span>{number}</span><div><h3>{title}</h3>{hint&&<p>{hint}</p>}</div></div>{children}</section>
}
const servicePrice=(s:ManagedService)=>s.pricing==="Miễn phí"||!s.price?"Miễn phí":`${s.price.toLocaleString("vi-VN")}đ/${s.pricing==="Theo tháng"?"tháng":s.pricing==="Theo lượt"?"lượt":"giờ"}`
function serviceNeeds(s:ManagedService,plateFree=false) {
  // Without a plate only the plate-free branches apply, so a "Biển số hoặc Thẻ" package then needs the card.
  const all=s.control.split(" hoặc "),usable=plateFree?all.filter(b=>!b.includes("Biển số")):all,mode=(usable.length?usable:all).join(" hoặc ")
  const needs:string[]=[]
  if(controlRequiresCard(mode))needs.push("cần thẻ Proximity/Mifare")
  if(controlRequiresUhf(mode))needs.push("cần xe có mã RFID")
  if(mode.split(" hoặc ").every(b=>b.includes("Khuôn mặt")))needs.push("cần ảnh khuôn mặt chủ thuê bao")
  if(!plateFree&&!controlRequiresPlate(s.control))needs.push("không bắt buộc biển số")
  return needs
}
/** Service list as readable rows: plain-language control, vehicle, price and what the package needs. */
function ServicePicker({label,hint,value,options,total,disabled,plateFree,directory,onChange}:{label:string;hint?:string;value:string;options:ManagedService[];total:number;disabled?:boolean;plateFree?:boolean
  directory:SubscriptionDirectory;onChange:(id:string)=>void}) {
  const [open,setOpen]=useState(!value)
  const chosen=directory.services.find(s=>s.id===value)
  const sorted=[...options].sort((a,b)=>a.name.localeCompare(b.name,"vi"))
  const rows=chosen?[...sorted.filter(s=>s.id===value),...sorted.filter(s=>s.id!==value)]:sorted
  const meta=(s:ManagedService)=>[s.energy?vehicleVariantLabel(s.vehicle,s.energy):s.vehicle,servicePrice(s),...serviceNeeds(s,plateFree)].join(" · ")
  return <div className="sr-svc-picker field">
    <span className="field-label">{label} <span className="required">*</span></span>
    {chosen&&!open?<div className="sr-svc-chosen"><div><strong>{chosen.name}{!chosen.active?" · Đã ngừng":""}</strong><span>{controlDescription(chosen.control,plateFree)}</span><small>{meta(chosen)}</small></div>
      <Button disabled={disabled} onClick={()=>setOpen(true)}>Đổi dịch vụ</Button></div>:<>
      <div className="sr-svc-list" role="radiogroup" aria-label={label}>
        {rows.map(s=><label key={s.id} className={`sr-svc-option ${s.id===value?"selected":""}`}>
          <input type="radio" name={`svc-${label}`} disabled={disabled} checked={s.id===value} onChange={()=>{onChange(s.id);setOpen(false)}}/>
          <span><strong>{s.name}{!s.active?" · Đã ngừng":""}</strong><span>{controlDescription(s.control,plateFree)}</span><small>{meta(s)}</small></span>
        </label>)}
        {!rows.length&&<p className="sr-hint">{disabled?"Chọn bãi xe trước.":"Không có gói phù hợp với bộ lọc. Đổi loại xe hoặc bỏ bớt lọc."}</p>}
      </div>
      <small className="sr-hint">Hiển thị {rows.length}/{total} gói.{chosen&&<> <Button variant="link" onClick={()=>setOpen(false)}>Giữ {chosen.name}</Button></>}</small>
    </>}
    {hint&&<span className="field-hint">{hint}</span>}
  </div>
}
export default function SubscriberRegistration({value:raw,state,onChange,onCreateCustomer,onEditCustomer,onCreateVehicle,onEditVehicle,onCard}:{
  value:SubscriberInput;state:OperationState;onChange:(patch:Partial<SubscriberInput>)=>void
  onCreateCustomer:()=>void;onEditCustomer:()=>void;onCreateVehicle:()=>void;onEditVehicle?:(id:string)=>void;onCard:(card:Card,id:string)=>void
}) {
  const value=registrationForCard(state,raw),directory=directoryOf(state)
  const currentCard=assignedCard(state,value.id)
  const selectedParks=managementParks.filter(p=>value.lots.some(l=>l.parkId===p.id))
  const activeLots=value.lots.filter(l=>l.active)
  const selectedServices=value.lots.map(l=>directory.services.find(s=>s.id===l.serviceId)).filter((s):s is ManagedService=>!!s)
  const [serviceMode,setServiceMode]=useState<"shared"|"individual">(()=>new Set(value.lots.map(l=>l.serviceId).filter(Boolean)).size>1?"individual":"shared")
  const lastEstate=useRef(value.estate)
  useEffect(()=>{if(lastEstate.current!==value.estate){setServiceMode("shared");lastEstate.current=value.estate}},[value.estate])
  const owner=directory.customers.find(c=>c.id===value.customerId)
  const customers=directory.customers.filter(c=>c.estate===value.estate&&(c.active||c.id===value.customerId)).map(c=>({value:c.id,label:`${c.name} · ${c.id} · ${c.phone||"Chưa có SĐT"}`}))
  const servicesReady=!!value.lots.length&&value.lots.every(l=>!!l.serviceId)
  const noPlateServiceConflict=(value.anyPlate||value.noPlate)&&activeLots.some(l=>controlRequiresPlate(directory.services.find(s=>s.id===l.serviceId)?.control||"Không"))
  const cardRequired=subscriberRequiresCard(directory,value)
  const cardUsed=profileUsesCard(directory,value)
  const cardParkId=value.cardParkId||activeLots[0]?.parkId||""
  const usesUhf=profileUsesUhf(directory,value),uhfRequired=profileRequiresUhf(directory,value)
  // A UHF service is always a monthly subscription, so VIP cards are not offered alongside it.
  const stock=state.cards.filter(c=>(c.type==="Thuê bao tháng"||c.type==="VIP"&&!usesUhf)&&subscriptionCardFits(state,registrationInput({...value,type:c.type}),c,cardParkId))
  const chosenCard=currentCard||state.cards.find(c=>c.id===value.cardId)
  const cardReady=servicesReady
  const vehicleOptions=directory.vehicles.filter(v=>v.estate===value.estate&&v.vehicle===value.vehicle&&(v.active||value.vehicleIds.includes(v.id))&&selectedServices.every(s=>!s.energy||s.energy===v.energy))
    .map(v=>({value:v.id,label:`${v.plate}${usesUhf?` · RFID ${v.rfid||"chưa có"}`:""} · ${vehicleVariantLabel(v.vehicle,v.energy)} · ${v.id}`}))
  // UHF gates read the RFID tag declared on the vehicle record.
  const rfidVehicle=profileRfidVehicle(directory,value),pickedVehicle=directory.vehicles.find(v=>v.id===value.vehicleIds[0])
  const commonServiceId=value.lots.length&&value.lots.every(l=>l.serviceId===value.lots[0].serviceId)?value.lots[0].serviceId:""
  const [vehicleTab,setVehicleTab]=useState(()=>value.vehicle||"Ô tô")
  const [methods,setMethods]=useState<ControlMethod[]>([])
  const [serviceQuery,setServiceQuery]=useState("")
  function serviceOptions(parkIds:string[],lotIndex?:number) {
    if(!parkIds.length)return []
    const others=lotIndex===undefined?[]:value.lots.filter((_,i)=>i!==lotIndex).map(l=>directory.services.find(s=>s.id===l.serviceId)).filter((s):s is ManagedService=>!!s)
    return directory.services.filter(s=>s.category==="Thuê bao"&&parkIds.every(id=>s.parkIds.includes(id))&&
      (!currentCard||s.vehicle===currentCard.vehicle)&&(!value.noPlate||!controlRequiresPlate(s.control))&&
      others.every(o=>o.vehicle===s.vehicle&&(!o.energy||!s.energy||o.energy===s.energy))&&
      (s.active||
        value.id&&parkIds.every(id=>directory.profiles.find(p=>p.id===value.id)?.lots.some(l=>l.parkId===id&&l.serviceId===s.id))))
  }
  // Services offered at every selected park (counts on the vehicle buttons); a card or chosen vehicle fixes the vehicle type.
  const scopeServices=value.lots.length?serviceOptions(value.lots.map(l=>l.parkId)):[]
  const vehicleLocked=!!currentCard||(!!value.vehicleIds.length&&!value.noPlate)
  const shownVehicle=vehicleLocked?value.vehicle:vehicleTab
  const visible=(list:ManagedService[])=>list.filter(s=>s.vehicle===shownVehicle&&methods.every(m=>controlMethods(s.control).includes(m))&&
    (!serviceQuery.trim()||normalize(s.name).includes(normalize(serviceQuery))))
  const noPlateMissingParks=value.noPlate?value.lots.filter(l=>!serviceOptions([l.parkId]).length).map(l=>managementParks.find(p=>p.id===l.parkId)?.park||l.parkId):[]
  function selectService(id:string,index?:number) {
    const service=directory.services.find(s=>s.id===id)
    // Switching to a bicycle package pre-ticks "Xe không có biển số" when the package allows it; the user can untick.
    const noPlate=value.noPlate||(!!service&&service.vehicle==="Xe đạp"&&value.vehicle!=="Xe đạp"&&value.type==="Thuê bao tháng"&&!value.vehicleIds.length&&!controlRequiresPlate(service.control))
    onChange({vehicle:service?.vehicle||value.vehicle,noPlate,energy:noPlate?(service?.energy||value.energy):value.energy,
      lots:value.lots.map((l,i)=>index===undefined||i===index?{...l,serviceId:id}:l)})
  }
  function togglePark(id:string,checked:boolean) {
    const parkIds=checked?[...value.lots.map(l=>l.parkId),id]:value.lots.filter(l=>l.parkId!==id).map(l=>l.parkId)
    const common=directory.services.find(s=>s.id===commonServiceId)
    onChange({lots:parkIds.map(parkId=>value.lots.find(l=>l.parkId===parkId)||{parkId,serviceId:serviceMode==="shared"&&common?.parkIds.includes(parkId)?common.id:"",active:true})})
  }
  return <div className="sr-registration">
    <Section number={1} title="Phạm vi sử dụng" hint="Chọn bãi một lần, dùng chung cho dịch vụ, phương tiện và thẻ của thuê bao.">
      <Field label="Khu đô thị" required><Select aria-label="Khu đô thị thuê bao" disabled={!!value.id} value={value.estate} onChange={e=>onChange({estate:e.target.value})} options={[{value:"",label:"Chọn khu đô thị"},...estates.map(e=>({value:e.id,label:e.name}))]}/></Field>
      <fieldset className="sr-parks" disabled={!value.estate}><legend>Bãi xe áp dụng <span className="required">*</span><small>Có thể chọn nhiều bãi</small></legend>
        {!value.estate&&<p className="muted">Chọn khu đô thị để xem các bãi xe.</p>}
        {managementParks.filter(p=>p.estate===value.estate).map(p=>{
          const lot=value.lots.find(l=>l.parkId===p.id),keepsCard=!!currentCard&&currentCard.park===p.park&&currentCard.estate===p.estate
          return <label className={`sr-park ${lot?"selected":""}`} key={p.id}><input type="checkbox" aria-label={`Áp dụng bãi ${p.park}`} checked={!!lot} disabled={keepsCard} onChange={e=>togglePark(p.id,e.target.checked)}/><span><strong>{p.park}</strong><small>{keepsCard?"Đang quản lý thẻ đã cấp":lot&&!lot.active?"Đang tạm ngừng áp dụng":p.label.split(" · ").at(-1)}</small></span></label>
        })}
      </fieldset>
    </Section>
    <Section number={2} title="Thông tin thuê bao">
      <div className="sm-form-grid">
        <div className="sr-owner"><EntityPicker key={value.estate} label="Chủ thuê bao" required value={value.customerId} disabled={!value.estate} onChange={customerId=>onChange({customerId,members:value.members.filter(id=>id!==customerId)})} options={customers}/>
          <Button className="sm-inline-add" disabled={!value.estate} onClick={onCreateCustomer}><Plus size={13}/>Tạo khách hàng mới</Button>
          {owner&&<small>Nhóm thuê bao: {customerSubscriptionGroup(owner)} · Căn hộ: {owner.apartment||"Chưa có"} · Ảnh khuôn mặt: {owner.faces?.length||0}/5 <Button variant="link" onClick={onEditCustomer}>Sửa hồ sơ khách hàng</Button></small>}
        </div>
        <Field label="Hiệu lực từ" required><Input type="date" aria-label="Hiệu lực thuê bao từ" value={value.from} onChange={e=>onChange({from:e.target.value})}/></Field>
        <Field label="Hiệu lực đến" required={value.type==="Thuê bao tháng"} hint={value.type==="VIP"?"Để trống nếu không giới hạn thời gian.":undefined}><Input type="date" aria-label="Hiệu lực thuê bao đến" min={value.from} value={value.to} onChange={e=>onChange({to:e.target.value})}/></Field>
      </div>
      {value.type==="Thuê bao tháng"&&value.group==="Gian hàng"&&(()=>{const ok=!!value.contract&&!!value.contractEnd&&value.contractEnd>=today&&value.contractEnd>=value.from
        return <p className={ok?"sr-hint sr-contract":"sm-warning sr-contract"} role="status">Hợp đồng lấy từ hồ sơ khách hàng: {value.contract?<strong>{value.contract} · đến {value.contractEnd.split("-").reverse().join("/")}</strong>:"Chưa có"}.{!ok&&" Hợp đồng cần còn hiệu lực từ ngày bắt đầu thuê bao."} {owner&&<Button variant="link" onClick={onEditCustomer}>{value.contract?"Cập nhật hợp đồng":"Bổ sung hợp đồng"} trong hồ sơ {owner.name}</Button>}</p>})()}
      {value.type==="Thuê bao tháng"&&value.group==="Cư dân"&&<p className={owner?.apartment?"sr-hint":"sm-warning"}>Căn hộ lấy từ hồ sơ chủ thuê bao: {owner?.apartment||"Bổ sung căn hộ trong hồ sơ khách hàng trước khi lưu."}</p>}
    </Section>
    <Section number={3} title="Dịch vụ áp dụng" hint="Dịch vụ quyết định loại phương tiện và chế độ kiểm soát.">
      {value.type==="Thuê bao tháng"&&<label className="sm-check"><input type="checkbox" aria-label="Xe không có biển số" checked={value.noPlate} disabled={!value.lots.length} onChange={e=>onChange({noPlate:e.target.checked,vehicleIds:[]})}/>Xe không có biển số<small className="sr-hint"> Chọn trước khi chọn dịch vụ: chỉ hiện dịch vụ không bắt buộc biển số.</small></label>}
      {value.noPlate&&noPlateMissingParks.length>0&&<p className="sm-warning" role="status">Chưa có dịch vụ Thuê bao không bắt buộc biển số tại {noPlateMissingParks.join(", ")}. Bổ sung dịch vụ (ví dụ chế độ “Thẻ”, “Biển số hoặc Thẻ”) tại Danh sách dịch vụ, hoặc bỏ chọn Xe không có biển số.</p>}
      {value.lots.length>1&&<div className="sr-service-mode" role="group" aria-label="Cách áp dụng dịch vụ"><label><input type="radio" name="service-mode" checked={serviceMode==="shared"} onChange={()=>{setServiceMode("shared");if(!commonServiceId)onChange({lots:value.lots.map(l=>({...l,serviceId:""}))})}}/>Dùng chung dịch vụ</label><label><input type="radio" name="service-mode" checked={serviceMode==="individual"} onChange={()=>setServiceMode("individual")}/>Chọn theo từng bãi</label></div>}
      {!!value.lots.length&&<div className="sr-svc-filters">
        <div className="sr-svc-vehicles" role="radiogroup" aria-label="Loại xe của dịch vụ">
          {(["Ô tô","Xe máy","Xe đạp"] as const).map(v=>{const n=scopeServices.filter(s=>s.vehicle===v).length
            return <button type="button" key={v} role="radio" aria-checked={shownVehicle===v} className={shownVehicle===v?"active":""} disabled={vehicleLocked&&v!==value.vehicle} onClick={()=>setVehicleTab(v)}>{v} <span>({n})</span></button>})}
          {vehicleLocked&&<small className="sr-hint">{currentCard?"Theo thẻ đã cấp":"Theo xe đã chọn"}</small>}
        </div>
        <div className="sr-svc-methods" role="group" aria-label="Lọc theo cách nhận diện">
          <span>Cách nhận diện:</span>
          {controlMethodKeys.map(m=><button type="button" key={m} aria-pressed={methods.includes(m)} className={methods.includes(m)?"active":""} onClick={()=>setMethods(methods.includes(m)?methods.filter(x=>x!==m):[...methods,m])}>{m==="RFID"?"RFID (UHF)":m}</button>)}
          {!!methods.length&&<Button variant="link" onClick={()=>setMethods([])}>Bỏ lọc</Button>}
        </div>
        <Input type="search" aria-label="Tìm dịch vụ" placeholder="Tìm theo tên gói…" value={serviceQuery} onChange={e=>setServiceQuery(e.target.value)}/>
      </div>}
      {serviceMode==="shared"?<ServicePicker label="Dịch vụ dùng chung" hint={selectedParks.length?`Áp dụng tại ${selectedParks.map(p=>p.park).join(", ")}.`:"Chọn bãi xe ở phần Phạm vi sử dụng trước."} disabled={!value.lots.length} value={commonServiceId||""} options={visible(serviceOptions(value.lots.map(l=>l.parkId)))} total={serviceOptions(value.lots.map(l=>l.parkId)).filter(s=>s.vehicle===shownVehicle).length} plateFree={value.noPlate||value.anyPlate} directory={directory} onChange={id=>selectService(id)}/>:
        <div className="sr-lot-services">{value.lots.map((lot,i)=><div key={lot.parkId}><ServicePicker label={`Dịch vụ tại ${managementParks.find(p=>p.id===lot.parkId)?.park||`bãi ${i+1}`}`} value={lot.serviceId} options={visible(serviceOptions([lot.parkId],i))} total={serviceOptions([lot.parkId],i).filter(s=>s.vehicle===shownVehicle).length} plateFree={value.noPlate||value.anyPlate} directory={directory} onChange={id=>selectService(id,i)}/>{value.id&&<label className="sm-check"><input type="checkbox" checked={lot.active} onChange={e=>onChange({lots:value.lots.map((l,j)=>i===j?{...l,active:e.target.checked}:l)})}/>Đang áp dụng</label>}</div>)}</div>}
      {!!value.lots.length&&!noPlateMissingParks.length&&!serviceOptions(value.lots.map(l=>l.parkId)).length&&serviceMode==="shared"&&<p className="sm-warning">Chưa có dịch vụ phù hợp dùng chung cho các bãi đã chọn. Chọn theo từng bãi hoặc bổ sung dịch vụ tại Danh sách dịch vụ.</p>}
      {noPlateServiceConflict&&<p className="sm-warning" role="status">Dịch vụ đang chọn bắt buộc biển số. {value.type==="VIP"?"Thêm biển số ở phần Phương tiện hoặc đổi sang dịch vụ không bắt buộc biển số nếu chỉ sử dụng thẻ VIP.":"Chọn dịch vụ không bắt buộc biển số cho xe không có biển số."}</p>}
      {profileRequiresFace(directory,value)&&!profileHasFace(directory,value)&&<div className="sm-warning">Dịch vụ yêu cầu khuôn mặt để nhận diện khách hàng. {owner?<Button variant="link" onClick={onEditCustomer}>Bổ sung khuôn mặt cho {owner.name}</Button>:"Chọn chủ thuê bao và bổ sung ảnh khuôn mặt trước khi lưu."}</div>}
    </Section>
    <Section number={4} title="Thẻ đăng ký" hint={usesUhf?"Dịch vụ dùng thẻ UHF dán trên xe (mã thẻ RFID khai báo trong hồ sơ xe) nên áp dụng quy tắc thuê bao tháng (một xe). Có thể đăng ký thêm thẻ Proximity/Mifare nếu cần.":"Chọn thẻ VIP để đăng ký nhiều biển số hoặc không đăng ký biển số. Thẻ tháng áp dụng cho một xe."}>
      {currentCard?<div className="sm-card-panel"><CreditCard size={23}/><div><strong>{currentCard.id}</strong><p>{currentCard.type} · {currentCard.vehicle}. Thu hồi thẻ trước khi thay thẻ, đổi loại thuê bao hoặc bỏ bãi đang quản lý thẻ.</p></div><Button onClick={()=>onCard(currentCard,value.id)}>Quản lý thẻ</Button></div>:servicesReady&&!cardUsed?<p className="sr-hint sr-no-card" role="status"><strong>Dịch vụ không sử dụng thẻ Proximity/Mifare.</strong> Thuê bao được nhận diện theo chế độ kiểm soát của dịch vụ nên không cấp thẻ.</p>:<>
        <p className={cardRequired?"sr-required-card":"sr-hint"}>{value.anyPlate?"Thuê bao dùng thẻ VIP. Có thể đăng ký biển số bên dưới hoặc để trống nếu dịch vụ hỗ trợ.":cardRequired?"Chế độ kiểm soát của dịch vụ yêu cầu thẻ Proximity/Mifare.":"Dịch vụ không bắt buộc thẻ Proximity/Mifare. Có thể cấp ngay trong lần đăng ký này."}</p>
        {activeLots.length>1?<Field label="Kho lấy thẻ" hint="Lấy thẻ từ một trong các bãi đã chọn; thẻ được sử dụng tại các bãi đang áp dụng."><Select aria-label="Kho lấy thẻ thuê bao" value={cardParkId} disabled={!servicesReady} onChange={e=>onChange({cardParkId:e.target.value,cardId:""})} options={activeLots.map(l=>({value:l.parkId,label:managementParks.find(p=>p.id===l.parkId)?.label||l.parkId}))}/></Field>:!!cardParkId&&<p className="sr-hint">Kho lấy thẻ: <strong>{managementParks.find(p=>p.id===cardParkId)?.park}</strong></p>}
        <EntityPicker key={cardParkId} label="Mã thẻ đăng ký (Proximity/Mifare)" required={cardRequired} disabled={!cardReady} value={value.cardId||""} onChange={cardId=>onChange({cardId,cardParkId})} options={stock.map(c=>({value:c.id,label:`${c.id} · ${c.type} · ${c.vehicle} · ${c.technology||"Chưa rõ kiểu"} · ${c.frontCode||"—"} / ${c.rearCode||"—"}`}))}/>
        {!cardReady&&<p className="sr-hint">Chọn dịch vụ để xem thẻ phù hợp.</p>}
        {cardReady&&!stock.length&&<p className="sm-warning" role="status">Kho {managementParks.find(p=>p.id===cardParkId)?.park||"đã chọn"} chưa có thẻ Thuê bao tháng hoặc VIP {value.vehicle.toLocaleLowerCase("vi")} còn trong kho. {activeLots.length>1?"Chọn kho lấy thẻ khác trong các bãi đang áp dụng hoặc nhập thêm thẻ tại Quản lý thẻ → Nhập kho thẻ.":"Nhập thêm thẻ tại Quản lý thẻ → Nhập kho thẻ."}</p>}
        {value.from>today&&<p className="sr-hint">Thẻ được giao khi lưu; quyền sử dụng bắt đầu từ ngày hiệu lực của thuê bao.</p>}
      </>}
      <p className="sr-hint" aria-live="polite">{value.type==="VIP"?"Đã chọn thẻ VIP · Thuê bao VIP: có thể chọn nhiều biển số hoặc để trống.":usesUhf?"Dịch vụ dùng thẻ UHF · Thuê bao tháng: sử dụng một xe.":servicesReady&&!cardUsed&&!currentCard?"Thuê bao tháng: sử dụng một xe.":chosenCard?"Đã chọn thẻ tháng · Thuê bao tháng: sử dụng một xe.":"Chưa chọn thẻ: áp dụng quy tắc thuê bao tháng. Chọn thẻ VIP để mở lựa chọn nhiều biển số."}</p>
      {chosenCard&&<details className="sr-card-details"><summary>Thông tin thẻ đã chọn</summary><div className="sm-detail-grid">{[["Mã mặt trước",chosenCard.frontCode],["Mã mặt sau",chosenCard.rearCode],["Kiểu thẻ",chosenCard.technology]].map(([label,v])=><div key={label}><span>{label}</span><strong>{v||"Chưa có thông tin"}</strong></div>)}</div></details>}
    </Section>
    <Section number={5} title="Phương tiện sử dụng" hint={value.type==="VIP"?"Có thể chọn nhiều biển số (tối đa 10) hoặc để trống và dùng thẻ VIP.":usesUhf?"Dịch vụ dùng đầu đọc UHF: tìm xe theo biển số hoặc mã thẻ RFID dán trên xe.":"Chọn một xe phù hợp dịch vụ hoặc khai báo xe không có biển số."}>
      {value.type==="Thuê bao tháng"&&value.noPlate&&<p className="sr-hint">Xe không có biển số (đã chọn ở phần Dịch vụ áp dụng).</p>}
      <fieldset disabled={!servicesReady} className="sr-vehicle-picker">
        {value.type==="VIP"?<><RelationChoices label="Biển số VIP" value={value.vehicleIds} max={10} options={vehicleOptions} onChange={vehicleIds=>onChange({vehicleIds})}/>{!!value.vehicleIds.length&&<div className="sr-selected-plates">{value.vehicleIds.map(id=><span key={id}>{directory.vehicles.find(v=>v.id===id)?.plate}<Button variant="ghost" aria-label={`Bỏ biển số ${directory.vehicles.find(v=>v.id===id)?.plate}`} onClick={()=>onChange({vehicleIds:value.vehicleIds.filter(v=>v!==id)})}><X size={12}/></Button></span>)}</div>}</>:
          value.noPlate?<Field label="Loại phương tiện" required><Select aria-label="Loại phương tiện không biển số" value={value.energy||""} onChange={e=>onChange({energy:e.target.value})} options={[{value:"",label:"Chọn loại phương tiện"},...vehicleVariantOptions(value.vehicle).filter(o=>selectedServices.every(s=>!s.energy||s.energy===o.value))]}/></Field>:
          <EntityPicker label="Xe của thuê bao" required disabled={!servicesReady} placeholder={usesUhf?"Tìm biển số, mã thẻ RFID hoặc mã xe…":undefined} value={value.vehicleIds[0]||""} onChange={id=>onChange({vehicleIds:id?[id]:[]})} options={vehicleOptions}/>
        }
        {!value.noPlate&&<Button className="sm-inline-add" disabled={!servicesReady||value.type==="VIP"&&value.vehicleIds.length>=10} onClick={onCreateVehicle}><Plus size={13}/>Tạo xe mới</Button>}
      </fieldset>
      {usesUhf&&rfidVehicle&&<p className="sr-hint sr-rfid" role="status">Thẻ UHF: <strong>{rfidVehicle.rfid}</strong> · gắn với xe {rfidVehicle.plate}. Đầu đọc UHF quét mã này để nhận diện xe.</p>}
      {usesUhf&&!value.noPlate&&pickedVehicle&&!rfidVehicle&&<div className={uhfRequired?"sm-warning":"sr-hint"} role="status">Xe {pickedVehicle.plate} chưa khai báo mã thẻ RFID.{uhfRequired?" Dịch vụ yêu cầu thẻ UHF nên cần bổ sung trước khi lưu. ":" Thuê bao vẫn dùng được các hình thức khác của dịch vụ. "}{onEditVehicle&&<Button variant="link" onClick={()=>onEditVehicle(pickedVehicle.id)}>Bổ sung mã thẻ RFID cho {pickedVehicle.plate}</Button>}</div>}
      {uhfRequired&&value.noPlate&&<p className="sm-warning" role="status">Dịch vụ yêu cầu thẻ UHF. Mã thẻ RFID gắn với hồ sơ xe nên xe không có biển số không dùng được dịch vụ này.</p>}
      {!servicesReady&&<p className="sr-hint">Chọn dịch vụ để xem các xe phù hợp.</p>}
      {servicesReady&&!value.noPlate&&<p className="sr-hint">Chỉ hiện xe {value.vehicle.toLocaleLowerCase("vi")} phù hợp dịch vụ đã chọn. Xe loại khác ({["Ô tô","Xe máy","Xe đạp"].filter(v=>v!==value.vehicle).map(v=>v.toLocaleLowerCase("vi")).join(", ")}) cần đăng ký thuê bao riêng với dịch vụ của loại xe đó.</p>}
      {value.type==="VIP"&&!value.vehicleIds.length&&<p className={noPlateServiceConflict?"sm-warning":"sr-hint"} role="status">{noPlateServiceConflict?"Dịch vụ bắt buộc biển số: chọn ít nhất một biển số hoặc đổi dịch vụ.":"Không đăng ký biển số: sử dụng thẻ VIP để nhận diện tại các bãi đang áp dụng."}</p>}
    </Section>
    <Section number={6} title="Hoàn tất">
      <Field label="Ghi chú"><Textarea aria-label="Ghi chú thuê bao" value={value.note} maxLength={500} onChange={e=>onChange({note:e.target.value})}/></Field>
      <div className="sr-final-summary" aria-live="polite"><strong>{value.type}</strong><span>{selectedParks.length} bãi · {value.vehicleIds.length} biển số · {chosenCard?`Thẻ ${chosenCard.id}`:cardRequired?"Chưa chọn thẻ bắt buộc":"Chưa cấp thẻ"}</span></div>
    </Section>
  </div>
}
