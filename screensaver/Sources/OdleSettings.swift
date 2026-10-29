import Foundation
import IOKit.ps
import ScreenSaver

// What the user can change in the screen saver options. Stored in the
// screen saver defaults of the bundle, read each time a scene is set up.
struct OdleSettings {

  enum TimeMode: Int {
    // 1 was the time-lapse, now removed: a stored 1 falls back to real time.
    // Accelerated runs the clock a few times faster, from the current time.
    case real = 0, fixed = 2, accelerated = 3
  }

  enum Season: Int {
    // 2 and 4 were spring and autumn, which the scene does not have: a stored
    // 2 or 4 falls back to automatic.
    case automatic = 0, winter = 1, summer = 3
  }

  struct Place {
    let name: String
    let latitude: Double
    let longitude: Double
    let timeZone: String
  }

  // The same list as the page's "Known locations", with their English names.
  // The order must not change: the options store the index of the place.
  static let places: [Place] = [
    Place(name: "Val di Funes", latitude: 46.6419, longitude: 11.7187, timeZone: "Europe/Rome"),
    Place(name: "Milan", latitude: 45.4642, longitude: 9.1900, timeZone: "Europe/Rome"),
    Place(name: "Amsterdam", latitude: 52.3676, longitude: 4.9041, timeZone: "Europe/Amsterdam"),
    Place(name: "Athens", latitude: 37.9838, longitude: 23.7275, timeZone: "Europe/Athens"),
    Place(name: "Belgrade", latitude: 44.7866, longitude: 20.4489, timeZone: "Europe/Belgrade"),
    Place(name: "Berlin", latitude: 52.5200, longitude: 13.4050, timeZone: "Europe/Berlin"),
    Place(name: "Bern", latitude: 46.9480, longitude: 7.4474, timeZone: "Europe/Zurich"),
    Place(name: "Brussels", latitude: 50.8476, longitude: 4.3572, timeZone: "Europe/Brussels"),
    Place(name: "Bucharest", latitude: 44.4268, longitude: 26.1025, timeZone: "Europe/Bucharest"),
    Place(name: "Budapest", latitude: 47.4979, longitude: 19.0402, timeZone: "Europe/Budapest"),
    Place(name: "Cape Town", latitude: -33.9249, longitude: 18.4241, timeZone: "Africa/Johannesburg"),
    Place(name: "Copenhagen", latitude: 55.6761, longitude: 12.5683, timeZone: "Europe/Copenhagen"),
    Place(name: "Atacama Desert", latitude: -23.0234, longitude: -67.7538, timeZone: "America/Santiago"),
    Place(name: "Dublin", latitude: 53.3498, longitude: -6.2603, timeZone: "Europe/Dublin"),
    Place(name: "Helsinki", latitude: 60.1699, longitude: 24.9384, timeZone: "Europe/Helsinki"),
    Place(name: "Islamabad", latitude: 33.6844, longitude: 73.0479, timeZone: "Asia/Karachi"),
    Place(name: "Kyiv", latitude: 50.4501, longitude: 30.5234, timeZone: "Europe/Kiev"),
    Place(name: "Lisbon", latitude: 38.7223, longitude: -9.1393, timeZone: "Europe/Lisbon"),
    Place(name: "London", latitude: 51.5074, longitude: -0.1278, timeZone: "Europe/London"),
    Place(name: "Los Angeles", latitude: 34.0522, longitude: -118.2437, timeZone: "America/Los_Angeles"),
    Place(name: "Madrid", latitude: 40.4168, longitude: -3.7038, timeZone: "Europe/Madrid"),
    Place(name: "Mauna Kea", latitude: 19.8207, longitude: -155.4681, timeZone: "Pacific/Honolulu"),
    Place(name: "New York", latitude: 40.7128, longitude: -74.0060, timeZone: "America/New_York"),
    Place(name: "New Delhi", latitude: 28.6139, longitude: 77.2090, timeZone: "Asia/Kolkata"),
    Place(name: "Oslo", latitude: 59.9139, longitude: 10.7522, timeZone: "Europe/Oslo"),
    Place(name: "Paris", latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris"),
    Place(name: "Beijing", latitude: 39.9042, longitude: 116.4074, timeZone: "Asia/Shanghai"),
    Place(name: "Prague", latitude: 50.0755, longitude: 14.4378, timeZone: "Europe/Prague"),
    Place(name: "Quito", latitude: -0.1807, longitude: -78.4678, timeZone: "America/Guayaquil"),
    Place(name: "Reykjavík", latitude: 64.1466, longitude: -21.9426, timeZone: "Atlantic/Reykjavik"),
    Place(name: "Rome", latitude: 41.9028, longitude: 12.4964, timeZone: "Europe/Rome"),
    Place(name: "Singapore", latitude: 1.3521, longitude: 103.8198, timeZone: "Asia/Singapore"),
    Place(name: "Stockholm", latitude: 59.3293, longitude: 18.0686, timeZone: "Europe/Stockholm"),
    Place(name: "Sydney", latitude: -33.8688, longitude: 151.2093, timeZone: "Australia/Sydney"),
    Place(name: "Tokyo", latitude: 35.6762, longitude: 139.6503, timeZone: "Asia/Tokyo"),
    Place(name: "Toronto", latitude: 43.6532, longitude: -79.3832, timeZone: "America/Toronto"),
    Place(name: "Tromsø", latitude: 69.6492, longitude: 18.9553, timeZone: "Europe/Oslo"),
    Place(name: "Ushuaia", latitude: -54.8019, longitude: -68.3030, timeZone: "America/Punta_Arenas"),
    Place(name: "Warsaw", latitude: 52.2297, longitude: 21.0122, timeZone: "Europe/Warsaw"),
    Place(name: "Vienna", latitude: 48.2082, longitude: 16.3738, timeZone: "Europe/Vienna"),
    Place(name: "Zagreb", latitude: 45.8150, longitude: 15.9819, timeZone: "Europe/Zagreb"),
  ]

  static let framesPerSecondChoices = [15, 24, 30]
  // How long a whole day lasts in the accelerated mode, in real minutes.
  static let dayMinutesChoices = [1, 3, 7, 15, 30]
  static let batteryFramesPerSecond = 15

  var timeMode = TimeMode.real
  // Minutes after midnight, in the time zone of the place.
  var fixedMinutes = 18 * 60 + 30
  var dayMinutes = 1
  var season = Season.automatic
  var placeIndex = 0
  var framesPerSecond = 24
  var showAnna = true
  var animateOnlyMainDisplay = false
  var reduceOnBattery = true

  private static var defaults: ScreenSaverDefaults? {
    ScreenSaverDefaults(forModuleWithName: "com.codingful.odle-saver")
  }

  static func load() -> OdleSettings {
    var settings = OdleSettings()
    guard let defaults = defaults else { return settings }
    defaults.synchronize()
    func integer(_ key: String) -> Int? {
      defaults.object(forKey: key) == nil ? nil : defaults.integer(forKey: key)
    }
    if let value = integer("timeMode"), let mode = TimeMode(rawValue: value) { settings.timeMode = mode }
    if let value = integer("fixedMinutes") { settings.fixedMinutes = min(1439, max(0, value)) }
    if let value = integer("dayMinutes"), dayMinutesChoices.contains(value) { settings.dayMinutes = value }
    if let value = integer("season"), let season = Season(rawValue: value) { settings.season = season }
    if let value = integer("placeIndex"), places.indices.contains(value) { settings.placeIndex = value }
    if let value = integer("framesPerSecond"), framesPerSecondChoices.contains(value) { settings.framesPerSecond = value }
    if defaults.object(forKey: "showAnna") != nil {
      settings.showAnna = defaults.bool(forKey: "showAnna")
    }
    if defaults.object(forKey: "animateOnlyMainDisplay") != nil {
      settings.animateOnlyMainDisplay = defaults.bool(forKey: "animateOnlyMainDisplay")
    }
    if defaults.object(forKey: "reduceOnBattery") != nil {
      settings.reduceOnBattery = defaults.bool(forKey: "reduceOnBattery")
    }
    return settings
  }

  func save() {
    guard let defaults = Self.defaults else { return }
    defaults.set(timeMode.rawValue, forKey: "timeMode")
    defaults.set(showAnna, forKey: "showAnna")
    defaults.set(fixedMinutes, forKey: "fixedMinutes")
    defaults.set(dayMinutes, forKey: "dayMinutes")
    defaults.set(season.rawValue, forKey: "season")
    defaults.set(placeIndex, forKey: "placeIndex")
    defaults.set(framesPerSecond, forKey: "framesPerSecond")
    defaults.set(animateOnlyMainDisplay, forKey: "animateOnlyMainDisplay")
    defaults.set(reduceOnBattery, forKey: "reduceOnBattery")
    defaults.synchronize()
  }

  var place: Place { Self.places[placeIndex] }

  // Query string for the page: place, and the instant the scene starts from.
  var pageQuery: String {
    var items = [
      URLQueryItem(name: "lat", value: String(place.latitude)),
      URLQueryItem(name: "lon", value: String(place.longitude)),
      URLQueryItem(name: "place", value: place.name),
    ]

    if !showAnna { items.append(URLQueryItem(name: "noAnna", value: "1")) }

    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: place.timeZone) ?? .current
    let now = Date()
    var start: Date?

    // A day of the chosen season in the current year, in the northern
    // hemisphere (the calendar seasons are swapped south of the equator).
    var day = calendar.dateComponents([.year, .month, .day], from: now)
    if let month = seasonMonth {
      day.month = month
      day.day = 15
    }

    switch timeMode {
    case .real, .accelerated:
      if timeMode == .accelerated {
        // The page takes the speed-up: a day in 7 minutes is about 206x.
        items.append(URLQueryItem(name: "timeSpeed", value: String(24.0 * 60 / Double(dayMinutes))))
      }
      if season != .automatic {
        // Same time of day as now, on a day of the season, then at real or
        // accelerated speed.
        var parts = calendar.dateComponents([.hour, .minute, .second], from: now)
        parts.year = day.year
        parts.month = day.month
        parts.day = day.day
        start = calendar.date(from: parts)
        items.append(URLQueryItem(name: "previewLive", value: "1"))
      }
    case .fixed:
      day.hour = fixedMinutes / 60
      day.minute = fixedMinutes % 60
      start = calendar.date(from: day)
    }

    if let start = start {
      let formatter = ISO8601DateFormatter()
      items.append(URLQueryItem(name: "previewTime", value: formatter.string(from: start)))
    }

    var components = URLComponents()
    components.queryItems = items
    return components.percentEncodedQuery ?? ""
  }

  private var seasonMonth: Int? {
    // Mid month of each season; swapped in the southern hemisphere.
    let southern = place.latitude < 0
    switch season {
    case .automatic: return nil
    case .winter: return southern ? 7 : 1
    case .summer: return southern ? 1 : 7
    }
  }

  // True when the Mac runs on its battery (a desktop has no battery).
  static func onBattery() -> Bool {
    guard let info = IOPSCopyPowerSourcesInfo()?.takeRetainedValue() else { return false }
    guard let type = IOPSGetProvidingPowerSourceType(info)?.takeUnretainedValue() as String? else { return false }
    return type == kIOPSBatteryPowerValue
  }
}
