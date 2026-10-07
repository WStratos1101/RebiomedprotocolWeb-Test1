import { useMemo, useState } from "react";
import { Beaker, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { parseLocaleNumber } from "@/lib/numberInput";
import { calculateBcaWorkingSolution } from "@/lib/bcaMath";

const format = (value: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 }).format(value);

export function BcaWorkingSolutionCalculator() {
  const [sampleWells, setSampleWells] = useState("1");
  const [blankWells, setBlankWells] = useState("1");
  const [volumePerWell, setVolumePerWell] = useState("200");

  const result = useMemo(() => calculateBcaWorkingSolution({
    sampleWells: parseLocaleNumber(sampleWells),
    blankWells: parseLocaleNumber(blankWells),
    volumePerWell: parseLocaleNumber(volumePerWell),
  }), [sampleWells, blankWells, volumePerWell]);

  const reset = () => {
    setSampleWells("1");
    setBlankWells("1");
    setVolumePerWell("200");
  };

  const field = (label: string, value: string, setter: (next: string) => void, help: string, unit = "µL") => (
    <label className="field-label bca-field">
      {label}
      <span>{help}</span>
      <div><Input value={value} onChange={event => setter(event.target.value)} inputMode="decimal" /><b>{unit}</b></div>
    </label>
  );

  return <section className="content-panel bca-working-solution">
    <div className="panel-heading">
      <div><span className="panel-index">PROTOCOL-ONLY TOOL / BCA</span><h2>Pha Working Solution BCA</h2><p>Chỉ hiển thị khi được liên kết vào một bước quy trình hoặc trong kho quản lý Admin.</p></div>
      <Beaker size={22} />
    </div>
    <div className="bca-working-grid">
      {field("Số giếng sử dụng", sampleWells, setSampleWells, "Không bao gồm giếng blank", "giếng")}
      {field("Số giếng blank", blankWells, setBlankWells, "Giếng đối chứng blank", "giếng")}
      {field("Dung tích working solution mỗi giếng", volumePerWell, setVolumePerWell, "Mặc định 200 µL")}
    </div>
    {result ? <div className="bca-results">
      <div><small>TỔNG SỐ GIẾNG</small><strong>{format(result.totalWells)}</strong><span>Giếng sử dụng + giếng blank</span></div>
      <div><small>REAGENT A CẦN DÙNG</small><strong>{format(result.reagentAVolume)} µL</strong><span>Working solution × tổng số giếng</span></div>
      <div><small>REAGENT B CẦN DÙNG</small><strong>{format(result.reagentBVolume)} µL</strong><span>Working solution ÷ 50 × tổng số giếng</span></div>
    </div> : <div className="chemical-warning">Nhập số giếng hợp lệ và dung tích working solution lớn hơn 0.</div>}
    <div className="editor-footer"><span>Đơn vị dung tích: µL</span><Button variant="outline" onClick={reset}><RotateCcw size={14} /> Đặt lại</Button></div>
  </section>;
}
