import type { Card } from "./data"
import { cardTypes, vehicles, today } from "./data"
import type { OperationState } from "./operations-model"
import { managementUnits } from "./subscription-model"
import { cardTechnologies } from "./vehicle-energy"

export interface CardEditInput {
  id: string
  frontCode: string
  rearCode: string
  technology: string
  type: string
  vehicle: string
  unitId: string
  note: string
}
export const cardEditInput = (card: Card): CardEditInput => ({
  id:card.id,frontCode:card.frontCode||"",rearCode:card.rearCode||"",technology:card.technology||"",
  type:card.type,vehicle:card.vehicle,unitId:card.unitId||"",note:card.note||"",
})
export function canReclassifyCard(state: OperationState, card: Card) {
  return card.status==="Trong kho" && !card.subscription &&
    !state.subscriptions.some(s=>s.cardId===card.id&&!s.ended)
}
const labels: Record<keyof Omit<CardEditInput,"id">,string>={frontCode:"Mã thẻ mặt trước",rearCode:"Mã thẻ mặt sau",technology:"Kiểu thẻ",type:"Loại thẻ",vehicle:"Loại phương tiện",unitId:"Đơn vị",note:"Mô tả"}
export function saveCardDetails(state: OperationState,input: CardEditInput): OperationState {
  const card=state.cards.find(c=>c.id===input.id)
  if(!card) throw new Error("Không tìm thấy thẻ. Mã thẻ đã tạo không được thay đổi.")
  const value={...input,frontCode:input.frontCode.trim(),rearCode:input.rearCode.trim(),note:input.note.trim()}
  if ([input.frontCode,input.rearCode].some(v=>v.trim().length>50||/[\u0000-\u001f\u007f]/.test(v))) throw new Error("Mã thẻ mặt trước/mặt sau tối đa 50 ký tự, không chứa ký tự điều khiển.")
  if(value.note.length>500) throw new Error("Mô tả tối đa 500 ký tự.")
  if(!cardTypes.includes(value.type)||!vehicles.includes(value.vehicle)) throw new Error("Chọn loại thẻ và loại phương tiện hợp lệ.")
  if(value.technology && !cardTechnologies.some(t=>t===value.technology)) throw new Error("Chọn kiểu thẻ Mifare hoặc Proximity. Thẻ UHF khai báo bằng mã thẻ RFID trong hồ sơ xe.")
  if(card.technology && !value.technology) throw new Error("Không bỏ trống kiểu thẻ đã có.")
  if(value.unitId && !managementUnits.some(u=>u.id===value.unitId&&u.estate===card.estate)) throw new Error("Đơn vị không phù hợp khu đô thị đang quản lý thẻ.")
  if((value.type!==card.type||value.vehicle!==card.vehicle)&&!canReclassifyCard(state,card)) throw new Error("Chỉ đổi loại thẻ hoặc loại phương tiện khi thẻ Trong kho và chưa gắn thuê bao. Cần thu hồi thẻ đang lưu hành trước.")
  const before=cardEditInput(card)
  const changes=(Object.keys(labels) as (keyof typeof labels)[]).filter(k=>before[k]!==value[k]).map(k=>`${labels[k]}: ${before[k]||"Chưa có"} → ${value[k]||"Để trống"}`)
  if(!changes.length) return state
  const at=new Date().toISOString()
  return {...state,cards:state.cards.map(c=>c.id===card.id?{...c,
    frontCode:value.frontCode,rearCode:value.rearCode,technology:value.technology,type:value.type,vehicle:value.vehicle,unitId:value.unitId,note:value.note,
    updatedAt:at,updatedBy:"Admin Local"}:c),
    activity:[{cardId:card.id,at:`${today}T${new Date().toLocaleTimeString("en-GB",{timeZone:"Asia/Ho_Chi_Minh"})}`,title:"Chỉnh sửa thông tin thẻ",reason:changes.join("; ")},...state.activity]}
}
