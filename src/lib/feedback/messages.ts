export function addedMessage(entityLabel: string, name?: string): string {
  return name ? `${entityLabel} "${name}" was added.` : `${entityLabel} was added successfully.`;
}

export function updatedMessage(entityLabel: string, name?: string): string {
  return name ? `${entityLabel} "${name}" was updated.` : `${entityLabel} was updated successfully.`;
}

export function deletedMessage(entityLabel: string, count = 1): string {
  return count === 1
    ? `${entityLabel} was deleted.`
    : `${count} ${entityLabel.toLowerCase()}${count === 1 ? "" : "s"} were deleted.`;
}

export function errorMessage(message: string): string {
  return message.trim() || "Something went wrong.";
}
