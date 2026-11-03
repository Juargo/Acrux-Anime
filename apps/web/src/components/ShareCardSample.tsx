// Figma 27:38 · "Tarjeta para compartir · Clásica", the sample shown on the sign-in screen.
// Built at its desktop size (324 × 576) and scaled down on small screens.
export function ShareCardSample() {
  return (
    <div className="share-card" aria-hidden="true">
      <div className="share-card__user">
        <span className="share-card__avatar">J</span>
        <span className="share-card__handle">@jorge</span>
        <img
          className="share-card__mark"
          src="/icons/marca.svg"
          alt=""
          width={26.4}
          height={26.4}
        />
      </div>
      <div className="share-card__total">
        <span className="share-card__count">48</span>
        <span className="share-card__label">ANIMES COMPLETOS</span>
      </div>
      <div className="share-card__watching">
        <span className="share-card__label">VIENDO AHORA</span>
        <div className="share-card__covers">
          <span className="share-card__cover" />
          <span className="share-card__cover" />
          <span className="share-card__cover" />
        </div>
      </div>
      <div className="share-card__footer">
        <span className="share-card__url">acrux.app/@jorge</span>
        <span className="share-card__qr">QR</span>
      </div>
    </div>
  );
}
