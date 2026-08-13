import { redirect } from "next/navigation"

// Billing contact was merged into Company Settings. Keep this route as a
// redirect so old links/bookmarks still land in the right place.
export default function BillingContactRedirect() {
  redirect("/dashboard/company/settings")
}
