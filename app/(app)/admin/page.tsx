import { redirect } from "next/navigation";

// รวมการจัดการก๊วน/แอดมินก๊วนไว้ที่แท็บ "ก๊วน" แล้ว
export default function AdminPage() {
  redirect("/groups");
}
