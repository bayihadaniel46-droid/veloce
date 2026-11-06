function HomeIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="m3.5 10 8.5-7 8.5 7v9.25a1.25 1.25 0 0 1-1.25 1.25h-14A1.25 1.25 0 0 1 4 19.25V10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 20.5v-6.25h6v6.25" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default HomeIcon;
