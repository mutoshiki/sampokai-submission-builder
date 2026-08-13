import {
  Button,
  ComboBox,
  FormGroup,
  InlineNotification,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  TextArea,
  TextInput,
} from "@carbon/react";
import { useEffect, useState } from "react";
import type { PlanInfo, RosterRecord } from "../types";
import { buildItineraryText, durationBetween } from "../lib/itinerary";
import { focusValidationTarget } from "../lib/focus";
import type { ValidationTarget } from "../types";
import { ContactEditor } from "./ContactEditor";
import { ItineraryEditor } from "./ItineraryEditor";
import { RouteImageUploader } from "./RouteImageUploader";

const standardEquipment = [
  "ザック",
  "登山靴",
  "雨具（レインウェアやザックカバー等）",
  "登山に適した服",
  "防寒着",
  "帽子",
  "昼食",
  "ゴミ袋（5～10L程度）",
  "行動食",
  "お金",
  "携帯電話",
  "この登山計画書（印刷したもの）",
  "学生証",
  "保険証",
  "時計",
  "モバイルバッテリー",
  "日焼け止め",
  "紙地図※",
  "コンパス※",
  "常備薬※",
  "ファーストエイドキット※",
  "ヘッドライト※",
  "温泉セット（タオルと着替え）",
];

interface PlanStepProps {
  plan: PlanInfo;
  roster: RosterRecord[];
  onChange: (plan: PlanInfo) => void;
  onPickRoute: () => void;
  includeHomeBase?: boolean;
  focusTarget: ValidationTarget | null;
  onFocusHandled: () => void;
}

export function PlanStep({ plan, roster, onChange, onPickRoute, includeHomeBase = true, focusTarget, onFocusHandled }: PlanStepProps) {
  const [selectedTab, setSelectedTab] = useState(0);
  const [invalidField, setInvalidField] = useState<string | null>(null);
  const [newEquipment, setNewEquipment] = useState("");
  const itineraryText = buildItineraryText(plan.itinerary);
  const duration = durationBetween(plan.entryTime, plan.exitTime);
  const homeBaseItems = roster.map((person, index) => ({ id: String(index), index, label: `${person.name} / ${person.phone || "連絡先なし"}` }));
  const selectedHomeBase = plan.homeBaseRosterIndex === null ? null : homeBaseItems.find((item) => item.index === plan.homeBaseRosterIndex) ?? null;
  const update = <K extends keyof PlanInfo>(key: K, value: PlanInfo[K]) => { setInvalidField(null); onChange({ ...plan, [key]: value }); };
  const extraEquipment = plan.equipment.filter((item) => !standardEquipment.includes(item));
  const addEquipment = () => {
    const item = newEquipment.trim();
    if (!item || plan.equipment.includes(item)) return;
    update("equipment", [...plan.equipment, item]);
    setNewEquipment("");
  };
  useEffect(() => {
    if (focusTarget?.tabIndex !== undefined) setSelectedTab(focusTarget.tabIndex);
    if (focusTarget) setInvalidField(focusTarget.fieldId);
  }, [focusTarget]);
  useEffect(() => {
    if (focusTarget && (focusTarget.tabIndex === undefined || focusTarget.tabIndex === selectedTab) && focusValidationTarget(focusTarget)) {
      onFocusHandled();
    }
  }, [focusTarget, onFocusHandled, selectedTab]);
  const invalid = (id: string) => invalidField === id;
  return (
    <section aria-labelledby="plan-heading">
      <div className="page-heading">
        <div>
          <h1 id="plan-heading">登山計画</h1>
        </div>
      </div>

      <Tabs selectedIndex={selectedTab} onChange={({ selectedIndex }) => setSelectedTab(selectedIndex)}>
        <TabList aria-label="登山計画の入力区分" contained>
          <Tab>行程</Tab>
          <Tab>登山ルート画像</Tab>
          <Tab>持参物・連絡先</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <FormGroup legendText="数値情報">
              <div className="form-grid form-grid--five">
                <TextInput id="entry-time" invalid={invalid("entry-time")} type="time" labelText="入山予定時刻" value={plan.entryTime} onChange={(event) => update("entryTime", event.target.value)} />
                <TextInput id="exit-time" invalid={invalid("exit-time")} type="time" labelText="下山予定時刻" value={plan.exitTime} onChange={(event) => update("exitTime", event.target.value)} />
                <TextInput id="ascent" invalid={invalid("ascent")} type="number" min="0" labelText="上り（m）" value={plan.ascent} onChange={(event) => update("ascent", event.target.value)} />
                <TextInput id="descent" invalid={invalid("descent")} type="number" min="0" labelText="下り（m）" value={plan.descent} onChange={(event) => update("descent", event.target.value)} />
                <TextInput id="distance" invalid={invalid("distance")} type="number" min="0" step="0.1" labelText="距離（km）" value={plan.distance} onChange={(event) => update("distance", event.target.value)} />
              </div>
              {duration ? <InlineNotification kind="info" title={`入山から下山まで ${duration}`} subtitle="休憩を含む予定時間として登山計画書へ反映します。" hideCloseButton lowContrast /> : null}
            </FormGroup>
            <ItineraryEditor points={plan.itinerary} onChange={(itinerary) => update("itinerary", itinerary)} />
            <div className="generated-preview" aria-label="行程文プレビュー">
              <p>{itineraryText || "地点を入力すると行程文が表示されます。"}</p>
            </div>
          </TabPanel>
          <TabPanel>
            <div id="route-image" tabIndex={-1}><RouteImageUploader path={plan.routeImagePath} onPick={onPickRoute} onClear={() => update("routeImagePath", "")} /></div>
            <TextArea
              id="escape-plan"
              invalid={invalid("escape-plan")}
              labelText="企画続行が不可能な場合の対応・エスケープルート"
              helperText="この項目がないと学務で受理されない可能性があると資料に明記されています。"
              rows={5}
              value={plan.escapePlan}
              onChange={(event) => update("escapePlan", event.target.value)}
            />
          </TabPanel>
          <TabPanel>
            <FormGroup legendText="追加の持参物（任意）">
              <InlineNotification kind="info" title="基本の持参物は計画書へ固定掲載します" subtitle="ここでは企画固有で追加したい持参物だけを入力します。" hideCloseButton lowContrast />
              <TextInput id="drink-quantity" invalid={invalid("drink-quantity")} labelText="飲料量" value={plan.drinkQuantity} placeholder="例：2L程度" onChange={(event) => update("drinkQuantity", event.target.value)} />
              {extraEquipment.length ? <div className="equipment-grid" id="equipment-grid">{extraEquipment.map((item) => <div className="setting-row" key={item}><span>{item}</span><Button type="button" kind="ghost" size="sm" onClick={() => update("equipment", plan.equipment.filter((value) => value !== item))}>削除</Button></div>)}</div> : null}
              <div className="setting-row">
                <TextInput
                  id="new-equipment"
                  labelText="持ち物を追加"
                  value={newEquipment}
                  placeholder="例：モバイルバッテリー"
                  onChange={(event) => setNewEquipment(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addEquipment();
                    }
                  }}
                />
                <Button type="button" kind="secondary" size="sm" onClick={addEquipment}>追加</Button>
              </div>
            </FormGroup>
            <div id="police-contacts" tabIndex={-1}>
              <ContactEditor title="管轄警察署" contacts={plan.policeContacts} onChange={(contacts) => update("policeContacts", contacts)} addLabel="警察署を追加" />
            </div>
            <ContactEditor title="山小屋等（任意）" contacts={plan.lodgeContacts} onChange={(contacts) => update("lodgeContacts", contacts)} addLabel="連絡先を追加" />
            {includeHomeBase ? <FormGroup legendText="留守本部">
              <ComboBox
                id="home-base-member"
                titleText="全体名簿から選択（任意）"
                items={homeBaseItems}
                selectedItem={selectedHomeBase}
                itemToString={(item) => item?.label ?? ""}
                placeholder="氏名で検索"
                onChange={({ selectedItem }) => {
                  if (!selectedItem) return;
                  const person = roster[selectedItem.index];
                  onChange({ ...plan, homeBaseRosterIndex: selectedItem.index, homeBaseName: person.name, homeBasePhone: person.phone });
                }}
              />
              <div className="form-grid form-grid--two">
                <TextInput id="home-base-name" labelText="留守本部氏名" value={plan.homeBaseName} onChange={(event) => update("homeBaseName", event.target.value)} />
                <TextInput id="home-base-phone" labelText="携帯電話番号" value={plan.homeBasePhone} onChange={(event) => update("homeBasePhone", event.target.value)} />
              </div>
            </FormGroup> : <InlineNotification kind="info" title="留守本部はサークル長が全体名簿から補完します" subtitle="引継ぎファイルには含めません。" hideCloseButton lowContrast />}
          </TabPanel>
        </TabPanels>
      </Tabs>
    </section>
  );
}
