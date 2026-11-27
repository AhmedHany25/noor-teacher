import { Navigate } from 'react-router'

/** Route: /review — replaced by the attendance page filtered on unrecorded lessons. */
export function ReviewScreen() {
  return <Navigate to="/attendance?status=none&preset=month" replace />
}
