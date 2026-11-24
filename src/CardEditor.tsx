import { useEffect, useState } from "react"
import { Check } from "lucide-react"
import { Button, Field, Form, Input, Overlay, Select, Textarea } from "./ui"
import { cardTypes, vehicles } from "./data"
import type { Card } from "./data"
import type { OperationState } from "./operations-model"
import { managementUnits } from "./subscription-model"
import { cardEditInput, canReclassifyCard, saveCardDetails } from "./card-edit"
import { cardTechnologies } from "./vehicle-energy"

export default function CardEditor({card,state,onSave,onClose,onDirty}:{card:Card;state:OperationState;onSave:(next:OperationState)=>void;onClose:()=>void;onDirty:(dirty:boolean)=>void}) {
  const [value,setValue]=useState(()=>cardEditInput(card))
  const [error,setError]=useState("")
  const [discard,setDiscard]=useState(false)
  const dirty=JSON.stringify(value)!==JSON.stringify(cardEditInput(card))
  const reclassify=canReclassifyCard(state,card)
  useEffect(()=>{onDirty(dirty);return ()=>onDirty(false)},[dirty,onDirty])
  const change=(patch:Partial<typeof value>)=>{setValue(v=>({...v,...patch}));setError("")}
  const close=()=>dirty?setDiscard(true):onClose()
  const save=()=>{try{onSave(saveCardDetails(state,value))}catch(e){setError((e as Error).message)}}
  return <>
    <Overlay wide title="Chỉnh sửa thông tin thẻ" subtitle={`Mã thẻ ${card.id} · ${card.park}`} onClose={close} dismissOnBackdrop={false}
      footer={<><Button onClick={close}>Hủy</Button><Button variant="primary" disabled={!dirty} onClick={save}><Check size={14}/>Lưu thay đổi</Button></>}>
      <Form onSubmit={e=>{e.preventDefault();if(dirty)save()}} className="sm-form">
        <div className="sm-form-grid">
          <Field label="Mã thẻ"><Input aria-label="Mã thẻ chỉnh sửa" value={card.id} readOnly/></Field>
          <Field label="Kho bãi quản lý"><Input value={card.park} readOnly/></Field>
          <Field label="Mã thẻ mặt trước"><Input aria-label="Mã thẻ mặt trước chỉnh sửa" maxLength={50} value={value.frontCode} onChange={e=>change({frontCode:e.target.value})}/></Field>
          <Field label="Mã thẻ mặt sau"><Input aria-label="Mã thẻ mặt sau chỉnh sửa" maxLength={50} value={value.rearCode} onChange={e=>change({rearCode:e.target.value})}/></Field>
          <Field label="Kiểu thẻ"><Select aria-label="Kiểu thẻ chỉnh sửa" value={value.technology} onChange={e=>change({technology:e.target.value})} options={[...(!card.technology?[{value:"",label:"Chưa có thông tin"}]:[]),...cardTechnologies]}/></Field>
          <Field label="Loại thẻ" required><Select aria-label="Loại thẻ chỉnh sửa" value={value.type} disabled={!reclassify} onChange={e=>change({type:e.target.value})} options={cardTypes}/></Field>
          <Field label="Loại phương tiện" required><Select aria-label="Loại phương tiện thẻ chỉnh sửa" value={value.vehicle} disabled={!reclassify} onChange={e=>change({vehicle:e.target.value})} options={vehicles}/></Field>
          <Field label="Đơn vị"><Select aria-label="Đơn vị thẻ chỉnh sửa" value={value.unitId} onChange={e=>change({unitId:e.target.value})} options={[{value:"",label:"Chưa chọn đơn vị"},...managementUnits.filter(u=>u.estate===card.estate).map(u=>({value:u.id,label:u.name}))]}/></Field>
        </div>
        <p className="sm-note">Mã thẻ và kho bãi được giữ theo hồ sơ nhập kho. {reclassify?"Có thể sửa loại thẻ và loại phương tiện khi thẻ còn Trong kho, chưa gắn thuê bao.":"Thẻ đã lưu hành hoặc đang gắn thuê bao: thu hồi và kiểm tra thẻ trước khi đổi loại thẻ/loại phương tiện."} Khóa/mở khóa, thu hồi và mất/hỏng được ghi nhận bằng các thao tác riêng trong chi tiết thẻ.</p>
        <Field label="Mô tả"><Textarea aria-label="Mô tả thẻ chỉnh sửa" maxLength={500} value={value.note} onChange={e=>change({note:e.target.value})}/></Field>
        {error&&<p className="sm-error" role="alert">{error}</p>}
        <button type="submit" className="sm-hidden-submit" tabIndex={-1} aria-hidden="true"/>
      </Form>
    </Overlay>
    {discard&&<Overlay title="Bỏ thay đổi thông tin thẻ?" onClose={()=>setDiscard(false)} footer={<><Button onClick={()=>setDiscard(false)}>Tiếp tục chỉnh sửa</Button><Button variant="primary" onClick={onClose}>Bỏ thay đổi</Button></>}><p>Các thay đổi thông tin thẻ chưa được lưu.</p></Overlay>}
  </>
}
