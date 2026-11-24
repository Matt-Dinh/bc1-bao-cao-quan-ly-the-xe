const test=require('node:test')
const assert=require('node:assert/strict')
const {seedOperations,applyOperation}=require('/tmp/vparking-model-tests/operations-model.js')
const {cardEditInput,saveCardDetails,canReclassifyCard}=require('/tmp/vparking-model-tests/card-edit.js')
const {directoryOf,saveManagedService}=require('/tmp/vparking-model-tests/subscription-model.js')
const {lookupCards,defaultCardLookupFilters,stockMetrics}=require('/tmp/vparking-model-tests/report-model.js')
const {defaults}=require('/tmp/vparking-model-tests/data.js')
const {vehicleChoiceOptions,matchesVehicleChoice}=require('/tmp/vparking-model-tests/vehicle-energy.js')
test('editing stock preserves codes with zeroes and records a classification correction without changing stock totals',()=>{
  const state=seedOperations(),card=state.cards.find(c=>c.status==='Trong kho'&&c.estate==='A'),before=JSON.stringify(state),historic=stockMetrics(defaults)
  const next=saveCardDetails(state,{...cardEditInput(card),frontCode:' 0000123 ',rearCode:'0000456',technology:'Thẻ Mifare',unitId:'BQL-A',note:'Mô tả kiểm thử',type:'Thuê bao tháng',vehicle:'Xe máy'})
  const saved=next.cards.find(c=>c.id===card.id)
  assert.equal(saved.frontCode,'0000123');assert.equal(saved.rearCode,'0000456')
  assert.equal(saved.vehicle,'Xe máy');assert.equal(saved.status,'Trong kho')
  assert.equal(next.cards.length,state.cards.length)
  assert.equal(next.cards.filter(c=>c.status==='Trong kho').length,state.cards.filter(c=>c.status==='Trong kho').length)
  assert.equal(saved.updatedBy,'Admin Local');assert.ok(saved.updatedAt)
  assert.ok(next.activity[0].reason.includes(`Mã thẻ mặt trước: ${card.frontCode || "Chưa có"} → 0000123`))
  assert.equal(JSON.stringify(state),before);assert.deepEqual(stockMetrics(defaults),historic)
  const result=lookupCards({...defaultCardLookupFilters,keyword:'0000123'},()=>30,next.cards)
  assert.ok(result.cards.some(c=>c.id===card.id))
})
test('circulating, locked, damaged and still-linked stock cards cannot change type or vehicle; metadata remains editable',()=>{
  const state=seedOperations()
  for(const status of ['Đang hoạt động','Khóa','Mất / hỏng']) {
    const card=state.cards.find(c=>c.status===status)
    assert.equal(canReclassifyCard(state,card),false)
    assert.throws(()=>saveCardDetails(state,{...cardEditInput(card),vehicle:card.vehicle==='Ô tô'?'Xe máy':'Ô tô'}),/thu hồi/)
    assert.doesNotThrow(()=>saveCardDetails(state,{...cardEditInput(card),note:'Bổ sung mô tả'}))
  }
  const card=state.cards.find(c=>c.status==='Trong kho'), linked={...state,cards:state.cards.map(c=>c.id===card.id?{...c,subscription:'TB-linked'}:c)}
  assert.equal(canReclassifyCard(linked,linked.cards.find(c=>c.id===card.id)),false)
  assert.throws(()=>saveCardDetails(linked,{...cardEditInput(card),vehicle:'Xe đạp'}),/thu hồi/)
})
test('metadata validation fails atomically and unchanged edits are no-ops',()=>{
  const state=seedOperations(),card=state.cards.find(c=>c.status==='Trong kho'&&c.estate==='A'),input=cardEditInput(card),before=JSON.stringify(state)
  for(const patch of [{id:'MISSING'},{frontCode:'a'.repeat(51)},{rearCode:'a\n'},{technology:'Unknown'},{vehicle:'Ô tô điện'},{type:'Invalid'},{note:'a'.repeat(501)},{unitId:'BQL-B'}]) {
    assert.throws(()=>saveCardDetails(state,{...input,...patch}));assert.equal(JSON.stringify(state),before)
  }
  assert.equal(saveCardDetails(state,input),state)
})
test('stock cards are Proximity or Mifare only; UHF tags are registered on the subscription',()=>{
  const state=seedOperations()
  const card=state.cards.find(c=>c.status==='Đang hoạt động'&&c.subscription&&c.vehicle==='Ô tô')
  const input=cardEditInput(card)
  assert.throws(()=>saveCardDetails(state,{...input,technology:'Thẻ UHF'}),/UHF khai báo bằng mã thẻ RFID/)
  assert.throws(()=>saveCardDetails(state,{...input,technology:''}),/bỏ trống/)
  assert.doesNotThrow(()=>saveCardDetails(state,{...input,technology:'Thẻ Proximity'}))
  assert.ok(state.cards.every(c=>c.technology!=='Thẻ UHF'))
})
test('imports never inherit descriptions, unit or edit audit from the template card',()=>{
  const state=seedOperations(),first=state.cards[0]
  const edited=saveCardDetails(state,{...cardEditInput(first),note:'Không sao chép',unitId:`BQL-${first.estate}`})
  const next=applyOperation(edited,{kind:'import',lot:{id:'LO-EDIT-QA',estate:'A',park:'Hầm B1 – S1',supplier:'QA',date:'2026-10-29',ids:['EDIT-QA-NEW']},type:'VIP',vehicle:'Ô tô'})
  const saved=next.cards.find(c=>c.id==='EDIT-QA-NEW')
  assert.equal(saved.note,'');assert.equal(saved.unitId,'');assert.equal(saved.updatedAt,undefined);assert.ok(saved.createdAt)
})
test('one vehicle selector maps six familiar names onto the three report groups and preserves service compatibility',()=>{
  const choices=vehicleChoiceOptions()
  assert.equal(choices.length,6);assert.equal(new Set(choices.map(c=>c.value)).size,6)
  assert.ok(choices.some(c=>c.label==='Ô tô điện'))
  assert.equal(matchesVehicleChoice('Ô tô','Điện','Ô tô|Điện'),true)
  assert.equal(matchesVehicleChoice('Xe máy','Điện','Ô tô|Điện'),false)
  assert.equal(matchesVehicleChoice('Ô tô','Xăng/dầu','Ô tô|Điện'),false)
  assert.equal(matchesVehicleChoice('Ô tô',undefined,'Ô tô|Điện',true),true)
  assert.equal(matchesVehicleChoice('Ô tô',undefined,'Ô tô|Điện'),false)
  assert.equal(matchesVehicleChoice('Xe đạp','Điện','Xe đạp|'),true)
})


test('all demo cards have unique printed codes, matching units and complete audit metadata without inventing stock ownership',()=>{
  const state=seedOperations(),again=seedOperations()
  const front=new Set(),rear=new Set(),technologies=new Set()
  for(const card of state.cards) {
    assert.match(card.frontCode,/^\d{10}$/)
    assert.match(card.rearCode,/^\d{10}$/)
    assert.ok(!front.has(card.frontCode),card.id);front.add(card.frontCode)
    assert.ok(!rear.has(card.rearCode),card.id);rear.add(card.rearCode)
    technologies.add(card.technology)
    assert.equal(card.unitId,`BQL-${card.estate}`)
    assert.ok(card.note.includes(card.id))
    assert.ok(card.createdBy && card.updatedBy)
    assert.ok(Date.parse(card.createdAt)<=Date.parse(card.updatedAt))
    if(card.id.includes('-NEW-')) {
      assert.equal(card.subscription,'');assert.equal(card.owner,'—');assert.equal(card.plate,'—')
    }
  }
  assert.equal(technologies.size,2)
  assert.deepEqual(again.cards,state.cards)
})
