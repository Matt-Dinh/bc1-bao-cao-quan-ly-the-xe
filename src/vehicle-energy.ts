export const energyKinds = [
  "Điện",
  "Xăng/dầu",
  "Không động cơ",
  "Chưa xác định",
] as const
export type EnergyKind = typeof energyKinds[number]
export const energyOptions = (vehicle: string) =>
  vehicle === "Xe đạp" ? ["Không động cơ", "Điện"] : ["Xăng/dầu", "Điện"]
/** Stocked card technologies. UHF tags are stuck on vehicles and declared as the vehicle's RFID code, never stocked. */
export const cardTechnologies = [
  "Thẻ Mifare",
  "Thẻ Proximity",
] as const
export const uhfTechnology = "Thẻ UHF"
export const unknownTechnology = "Chưa có thông tin"
export const energyMatches = (scope: string | undefined, energies: string[]) =>
  !scope ||
  (energies.length > 0 && energies.every((energy) => energy === scope))
export const vehicleVariantLabel = (
  vehicle: string,
  energy?: string,
  all = false,
) => {
  if (!energy && all) return `${vehicle} · tất cả`
  if (energy === "Điện") return `${vehicle} điện`
  if (energy === "Xăng/dầu") return `${vehicle} (xăng/dầu)`
  if (energy === "Không động cơ") return "Xe đạp thường"
  return `${vehicle} · chưa xác định`
}
export const vehicleVariantOptions = (vehicle: string, all = false) => [
  ...(all
    ? [
        {
          value: "",
          label: `Tất cả ${vehicle.toLocaleLowerCase("vi")} (gồm xe điện)`,
        },
      ]
    : []),
  ...energyOptions(vehicle).map((energy) => ({
    value: energy,
    label: vehicleVariantLabel(vehicle, energy),
  })),
]
export const vehicleChoiceOptions = (withGroups = false) =>
  ["Ô tô", "Xe máy", "Xe đạp"].flatMap(vehicle => [
    ...(withGroups ? [{value:`${vehicle}|`,label:`${vehicle} (${vehicle==="Xe đạp"?"thường và điện":"xăng/dầu và điện"})`}] : []),
    ...vehicleVariantOptions(vehicle).map(o=>({value:`${vehicle}|${o.value}`,label:o.label})),
  ])
export function matchesVehicleChoice(vehicle: string, energy: string | undefined, choice: string, service = false) {
  if (!choice) return true
  if (choice === "Chưa xác định") return !energy || energy === "Chưa xác định"
  const [group,variant] = choice.split("|")
  return group === vehicle && (!variant || variant === (energy || "Chưa xác định") || service && !energy)
}

/** OR between selected variants; shared services cover either variant in their group. */
export const matchesVehicleChoices = (vehicle: string, energy: string | undefined, choices: readonly string[], service = false) =>
  !choices.length || choices.some(choice => matchesVehicleChoice(vehicle, energy, choice, service))
