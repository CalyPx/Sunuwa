export default function SunuwaLogo({ size = 62 }: { size?: number; light?: boolean }) {
  return (
    <img
      src="/logo.png"
      width={size}
      height={size}
      alt="सुनुवा"
      style={{ flexShrink: 0, objectFit: 'contain' }}
    />
  )
}
