export default function LoadingButton({ loading, loadingText, children, className, ...props }) {
  return (
    <button {...props} className={className} disabled={props.disabled || loading}>
      {loading ? loadingText || 'Loading...' : children}
    </button>
  )
}
