/** Shared helpers for Schedule + Cancel & refund screens */

export const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=400&q=80";

export const mapBookingsToScheduleItems = (list) => {
  if (!Array.isArray(list) || list.length === 0) return [];
  return list.map((b) => {
    const startDate = b.trip_start_date || b.created_at;
    let dateStr = "";
    if (startDate) {
      const d = new Date(startDate);
      dateStr = d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    } else {
      dateStr = "Date TBA";
    }
    const location =
      b.package_location && b.package_country
        ? `${b.package_location}, ${b.package_country}`
        : b.package_location || "—";
    return {
      id: String(b.id),
      title: b.package_title || "Trip",
      location,
      date: dateStr,
      image: b.package_image_url || PLACEHOLDER_IMAGE,
      booking: b,
      paymentStatus: b.payment_status || null,
      tripStartDateRaw: b.trip_start_date || null,
      packageData: {
        id: b.package_id,
        title: b.package_title,
        location: b.package_location,
        country: b.package_country,
        main_image_url: b.package_image_url,
      },
    };
  });
};

/** Same rule as Upcoming trips: confirmed booking on an active package. */
export const filterUpcomingConfirmedBookings = (bookings) => {
  if (!Array.isArray(bookings)) return [];
  return bookings.filter((b) => {
    if (b.status !== "confirmed") return false;
    return (b.package_status || "").toLowerCase() === "active";
  });
};
