import { useEffect } from "react";

export default function QRCodeModal({ isOpen, onClose, qrCodeData, accessCode, eventName }) {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content">
        <div className="modal-header">
          <div className="modal-title">Event QR Code</div>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
        <div className="modal-body">
          {eventName && (
            <div style={{ fontWeight: 600, fontSize: "16px", textAlign: "center" }}>
              {eventName}
            </div>
          )}
          <div className="qr-code-container">
            {qrCodeData ? (
              <img src={qrCodeData} alt={`QR code for event ${accessCode}`} />
            ) : (
              <div>Loading QR code...</div>
            )}
          </div>
          <div className="modal-access-code">{accessCode}</div>
          <div className="modal-hint">
            Scan this QR code or enter the access code to check in
          </div>
        </div>
      </div>
    </div>
  );
}
