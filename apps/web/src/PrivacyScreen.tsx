/* Политика конфиденциальности — /privacy (страж App Store, гайдлайн 5.1).
 * Каждый пункт — факт кода: oauth.ts (Google/Apple: имя, e-mail) ·
 * track.ts + /me/bookmark (прогресс в D1) · localStorage (настройки/заметки)
 * · push.ts (endpoint подписки) · сторонних трекеров и рекламной аналитики нет. */
import { SITE_HOST } from "./routes";
import { GroupedCanvas, Groups, Group, Row } from "./ui/ios";

const INK = "var(--color-label)";

function Back() {
  return (
    <svg width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden>
      <path d="M10.5 1.5 2 10l8.5 8.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const P = ({ children }: { children: React.ReactNode }) => (
  <p style={{ margin: "0 0 10px", font: "400 15px/1.5 var(--font-text)", color: "var(--color-label-2)" }}>{children}</p>
);

export default function PrivacyScreen({ onBack }: { onBack: () => void }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, margin: "2px 0 6px" }}>
        <button type="button" aria-label="Назад" onClick={onBack} style={{ display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", background: "none", color: INK, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}><Back /></button>
        <h1 style={{ margin: 0, font: "700 22px/1.2 var(--font-display)", color: INK }}>Конфиденциальность</h1>
      </div>
      <GroupedCanvas>
        <Groups>
          <Group header="Оператор">
            <Row title={`ISKCON ONE LOVE · ${SITE_HOST}`} subtitle="Связь: ceo@billionsx.com" />
          </Group>
          <Group header="Что мы храним">
            <div style={{ padding: "10px 16px 4px" }}>
              <P>Аккаунт — только при входе через Google или Apple: имя и адрес электронной почты, которые передаёт провайдер входа.</P>
              <P>Прогресс практики — закладки, позиции чтения, отметки садханы и джапы — хранится в облачной базе, чтобы быть доступным на ваших устройствах после входа.</P>
              <P>Локально на устройстве — настройки, заметки и позиции чтения (хранилище браузера); без входа в аккаунт они не покидают устройство.</P>
              <P>Уведомления — при включении push сохраняется технический адрес подписки браузера; отключается одним переключателем в кабинете.</P>
            </div>
          </Group>
          <Group header="Чего мы не делаем">
            <div style={{ padding: "10px 16px 4px" }}>
              <P>Не размещаем рекламу, не подключаем сторонние трекеры и рекламную аналитику, не продаём и не передаём данные третьим лицам.</P>
            </div>
          </Group>
          <Group header="Ваши права">
            <div style={{ padding: "10px 16px 4px" }}>
              <P>Выйти из аккаунта можно в любой момент. Для удаления аккаунта и связанных данных напишите на ceo@billionsx.com — удалим и подтвердим ответным письмом.</P>
            </div>
          </Group>
        </Groups>
      </GroupedCanvas>
    </div>
  );
}
