export const truncateLink = (link: string, maxLength: number) => {
  if (!link) {
    return '';
  }
  const formattedLink = link
    .replace(/^https?:\/\//, '') // remove protocol
    .replace(/^www\./, '') // remove www.
    .split('/')[0]; // remove path

  if (formattedLink.length > maxLength) {
    return formattedLink.substring(0, maxLength) + '...';
  }
  return formattedLink;
};
