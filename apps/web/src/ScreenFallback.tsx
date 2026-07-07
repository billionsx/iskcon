/**
 * Заглушка для <Suspense>, пока подгружается чанк лениво загружаемого экрана.
 * Нейтральный субтильный скелетон в стиле приложения (пульс darPulse, --color-fill-2).
 * Работает и в таб-аутлете (инлайн), и в полноэкранном оверлее — прозрачный фон,
 * контент центрируется, занимает доступную высоту. Появляется только на время
 * сетевой загрузки чанка (после первого раза чанк в кэше — заглушки не видно).
 */
export function ScreenFallback() {
  const bar = (w: string, h = 12) => ({
    width: w,
    height: h,
    borderRadius: 7,
    background: "var(--color-fill-2, rgba(120,120,128,0.12))",
    animation: "sfPulse 1.4s ease-in-out infinite",
  });
  return (
    <div
      aria-hidden
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: "10px 2px",
        minHeight: "40vh",
      }}
    >
      <style>{`@keyframes sfPulse{0%,100%{opacity:1}50%{opacity:.45}}`}</style>
      <div style={bar("62%", 22)} />
      <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              flex: "0 0 auto",
              width: 68,
              height: 68,
              borderRadius: "50%",
              background: "var(--color-fill-2, rgba(120,120,128,0.12))",
              animation: "sfPulse 1.4s ease-in-out infinite",
            }}
          />
        ))}
      </div>
      <div style={{ ...bar("100%"), marginTop: 8 }} />
      <div style={bar("92%")} />
      <div style={bar("96%")} />
      <div style={bar("70%")} />
    </div>
  );
}

export default ScreenFallback;
