import React from "react"

interface InputProps {
  label?: string
  type?: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
}

export default function Input({
  label,
  type = "text",
  placeholder,
  value,
  onChange
}: InputProps) {
  return (
    <div className="flex flex-col space-y-1">
      {label && <label className="text-sm font-medium">{label}</label>}

      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          onChange(e.target.value)
        }
        className="bg-gray-200 focus:bg-white border border-gray-400 rounded py-2 px-4 w-full"
      />
    </div>
  )
}
