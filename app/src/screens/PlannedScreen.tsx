import { PageHeader } from '../components/PageHeader'
/** Placeholder for a screen whose feature is scheduled in SPEC.md but not built yet. */
export function PlannedScreen({ title, what }: { title: string; what: string }) {
  return (
    <>
      <PageHeader title={title} />
      <section className="empty">
        <p>{what}</p>
        <span className="soon">قيد البناء</span>
      </section>
    </>
  )
}
