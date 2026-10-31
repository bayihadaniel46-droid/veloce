function FloatingButton({ onClick, isRaised = false }) {
  return (
    <button
      className={`floating-btn${isRaised ? " floating-btn-raised" : ""}`}
      onClick={onClick}
    >
      +
    </button>
  );
}

export default FloatingButton;
