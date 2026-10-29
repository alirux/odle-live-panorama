import AppKit

// The options window of the screen saver, shown as a sheet by System Settings.
final class OdleConfigSheet: NSObject {

  let window: NSWindow
  // Called after OK, once the choices are saved.
  var onSave: (() -> Void)?
  private static let seasons: [OdleSettings.Season] = [.automatic, .winter, .summer]
  private static let timeModes: [OdleSettings.TimeMode] = [.real, .accelerated, .fixed]
  // The site's pages, in English like this window.
  private static let privacyURL = URL(string: "https://www.alilab.it/privacy.html?lang=en")!
  private static let licenceURL = URL(string: "https://www.alilab.it/licence.html?lang=en")!

  private let timeMode = NSPopUpButton()
  private let fixedPicker = NSDatePicker()
  private let dayLength = NSPopUpButton()
  private let season = NSPopUpButton()
  private let place = NSPopUpButton()
  private let framesPerSecond = NSPopUpButton()
  private let mainDisplayOnly = NSButton(checkboxWithTitle: "Animate only the main display", target: nil, action: nil)
  private let reduceOnBattery = NSButton(checkboxWithTitle: "Reduce to \(OdleSettings.batteryFramesPerSecond) fps on battery", target: nil, action: nil)
  private let showAnna = NSButton(checkboxWithTitle: "Show Anna", target: nil, action: nil)
  private var fixedRow: NSStackView!
  private var dayLengthRow: NSStackView!

  override init() {
    window = NSWindow(
      contentRect: NSRect(x: 0, y: 0, width: 440, height: 340),
      styleMask: [.titled],
      backing: .buffered,
      defer: false
    )
    super.init()
    build()
    load(OdleSettings.load())
  }

  private func build() {
    timeMode.addItems(withTitles: ["Real time", "Accelerated", "Fixed time"])
    timeMode.target = self
    timeMode.action = #selector(timeModeChanged)

    fixedPicker.datePickerStyle = .textFieldAndStepper
    fixedPicker.datePickerElements = .hourMinute

    dayLength.addItems(withTitles: OdleSettings.dayMinutesChoices.map { minutes in
      minutes == 1 ? "1 minute" : "\(minutes) minutes"
    })

    season.addItems(withTitles: ["Automatic", "Winter", "Summer"])
    place.addItems(withTitles: OdleSettings.places.map(\.name))
    framesPerSecond.addItems(withTitles: OdleSettings.framesPerSecondChoices.map { "\($0) fps" })

    let ok = NSButton(title: "OK", target: self, action: #selector(accept))
    ok.keyEquivalent = "\r"
    let cancel = NSButton(title: "Cancel", target: self, action: #selector(cancel))
    cancel.keyEquivalent = "\u{1b}"
    let buttons = NSStackView(views: [cancel, ok])
    buttons.spacing = 12

    let links = NSStackView(views: [
      link("Privacy", Self.privacyURL, #selector(openPrivacy)),
      link("Licence", Self.licenceURL, #selector(openLicence)),
    ])
    links.spacing = 14

    func row(_ title: String, _ control: NSView) -> NSStackView {
      let label = NSTextField(labelWithString: title)
      label.alignment = .right
      label.widthAnchor.constraint(equalToConstant: 120).isActive = true
      let row = NSStackView(views: [label, control])
      row.spacing = 10
      row.alignment = .centerY
      return row
    }

    fixedRow = row("Time of day", fixedPicker)
    dayLengthRow = row("A day lasts", dayLength)

    let form = NSStackView(views: [
      row("Time", timeMode),
      fixedRow,
      dayLengthRow,
      row("Season", season),
      row("Place", place),
      row("Frame rate", framesPerSecond),
      row("", showAnna),
      row("", mainDisplayOnly),
      row("", reduceOnBattery),
    ])
    form.orientation = .vertical
    form.alignment = .leading
    form.spacing = 12

    let content = NSView()
    for view in [form, buttons, links] {
      view.translatesAutoresizingMaskIntoConstraints = false
      content.addSubview(view)
    }
    NSLayoutConstraint.activate([
      form.topAnchor.constraint(equalTo: content.topAnchor, constant: 20),
      form.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: 20),
      form.trailingAnchor.constraint(equalTo: content.trailingAnchor, constant: -20),
      buttons.topAnchor.constraint(equalTo: form.bottomAnchor, constant: 20),
      buttons.trailingAnchor.constraint(equalTo: content.trailingAnchor, constant: -20),
      buttons.bottomAnchor.constraint(equalTo: content.bottomAnchor, constant: -20),
      links.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: 20),
      links.centerYAnchor.constraint(equalTo: buttons.centerYAnchor),
    ])
    window.contentView = content
  }

  // A borderless button that looks like a link and opens a page of the site.
  private func link(_ title: String, _ url: URL, _ action: Selector) -> NSButton {
    let button = NSButton(title: title, target: self, action: action)
    button.isBordered = false
    button.attributedTitle = NSAttributedString(string: title, attributes: [
      .foregroundColor: NSColor.linkColor,
      .font: NSFont.systemFont(ofSize: NSFont.smallSystemFontSize),
    ])
    button.toolTip = url.absoluteString
    return button
  }

  @objc private func openPrivacy() {
    NSWorkspace.shared.open(Self.privacyURL)
  }

  @objc private func openLicence() {
    NSWorkspace.shared.open(Self.licenceURL)
  }

  private func load(_ settings: OdleSettings) {
    timeMode.selectItem(at: Self.timeModes.firstIndex(of: settings.timeMode) ?? 0)
    showAnna.state = settings.showAnna ? .on : .off

    var parts = Calendar.current.dateComponents([.year, .month, .day], from: Date())
    parts.hour = settings.fixedMinutes / 60
    parts.minute = settings.fixedMinutes % 60
    fixedPicker.dateValue = Calendar.current.date(from: parts) ?? Date()
    dayLength.selectItem(at: OdleSettings.dayMinutesChoices.firstIndex(of: settings.dayMinutes) ?? 0)
    season.selectItem(at: Self.seasons.firstIndex(of: settings.season) ?? 0)
    place.selectItem(at: settings.placeIndex)
    if let index = OdleSettings.framesPerSecondChoices.firstIndex(of: settings.framesPerSecond) {
      framesPerSecond.selectItem(at: index)
    }
    mainDisplayOnly.state = settings.animateOnlyMainDisplay ? .on : .off
    reduceOnBattery.state = settings.reduceOnBattery ? .on : .off
    timeModeChanged()
  }

  // Only the row of the chosen mode is shown.
  @objc private func timeModeChanged() {
    let mode = Self.timeModes[timeMode.indexOfSelectedItem]
    fixedRow.isHidden = mode != .fixed
    dayLengthRow.isHidden = mode != .accelerated
    if let content = window.contentView {
      content.layoutSubtreeIfNeeded()
      window.setContentSize(NSSize(width: 440, height: content.fittingSize.height))
    }
  }

  @objc private func accept() {
    var settings = OdleSettings()
    settings.timeMode = Self.timeModes[timeMode.indexOfSelectedItem]
    settings.showAnna = showAnna.state == .on
    let time = Calendar.current.dateComponents([.hour, .minute], from: fixedPicker.dateValue)
    settings.fixedMinutes = (time.hour ?? 0) * 60 + (time.minute ?? 0)
    settings.dayMinutes = OdleSettings.dayMinutesChoices[dayLength.indexOfSelectedItem]
    settings.season = Self.seasons[season.indexOfSelectedItem]
    settings.placeIndex = place.indexOfSelectedItem
    settings.framesPerSecond = OdleSettings.framesPerSecondChoices[framesPerSecond.indexOfSelectedItem]
    settings.animateOnlyMainDisplay = mainDisplayOnly.state == .on
    settings.reduceOnBattery = reduceOnBattery.state == .on
    settings.save()
    close()
    onSave?()
  }

  @objc private func cancel() {
    close()
  }

  private func close() {
    if let parent = window.sheetParent {
      parent.endSheet(window)
    } else {
      NSApplication.shared.endSheet(window)
    }
    window.orderOut(nil)
  }
}
