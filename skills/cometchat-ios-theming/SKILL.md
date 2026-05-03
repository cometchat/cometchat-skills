---
name: cometchat-ios-theming
description: "Customize the look and feel of CometChat iOS UI Kit — colors, fonts, styles, and dark mode support."
license: "MIT"
compatibility: "CometChatUIKitSwift ^5; iOS 13+"
allowed-tools: "executeBash, readFile, fileSearch, listDirectory"
metadata:
  author: "CometChat"
  version: "3.0.0"
  tags: "chat cometchat ios theming colors fonts styles dark-mode"
---

## Purpose

This skill teaches how to customize the visual appearance of CometChat iOS UI Kit components. It covers global theming, component-level styling, dark mode support, and creating custom themes.

---

## 1. Global Theme Configuration

CometChat iOS UI Kit uses `CometChatTheme` for global styling. Configure it early in your app lifecycle, before showing any CometChat UI.

### Primary Colors

```swift
import CometChatUIKitSwift

// Set primary brand color
CometChatTheme.primaryColor = UIColor.systemBlue

// Set extended palette (50-900 scale)
CometChatTheme.extendedPrimaryColor50 = UIColor.systemBlue.withAlphaComponent(0.05)
CometChatTheme.extendedPrimaryColor100 = UIColor.systemBlue.withAlphaComponent(0.1)
CometChatTheme.extendedPrimaryColor200 = UIColor.systemBlue.withAlphaComponent(0.2)
CometChatTheme.extendedPrimaryColor300 = UIColor.systemBlue.withAlphaComponent(0.3)
CometChatTheme.extendedPrimaryColor400 = UIColor.systemBlue.withAlphaComponent(0.4)
CometChatTheme.extendedPrimaryColor500 = UIColor.systemBlue.withAlphaComponent(0.5)
CometChatTheme.extendedPrimaryColor600 = UIColor.systemBlue.withAlphaComponent(0.6)
CometChatTheme.extendedPrimaryColor700 = UIColor.systemBlue.withAlphaComponent(0.7)
CometChatTheme.extendedPrimaryColor800 = UIColor.systemBlue.withAlphaComponent(0.8)
CometChatTheme.extendedPrimaryColor900 = UIColor.systemBlue.withAlphaComponent(0.9)
```

### Background Colors

```swift
// Main backgrounds (01 = primary, 02 = secondary, etc.)
CometChatTheme.backgroundColor01 = UIColor.systemBackground
CometChatTheme.backgroundColor02 = UIColor.secondarySystemBackground
CometChatTheme.backgroundColor03 = UIColor.tertiarySystemBackground
CometChatTheme.backgroundColor04 = UIColor.quaternarySystemFill
```

### Text Colors

```swift
// Text hierarchy
CometChatTheme.textColorPrimary = UIColor.label
CometChatTheme.textColorSecondary = UIColor.secondaryLabel
CometChatTheme.textColorTertiary = UIColor.tertiaryLabel
CometChatTheme.textColorDisabled = UIColor.placeholderText
CometChatTheme.textColorWhite = UIColor.white
CometChatTheme.textColorHighlight = UIColor.systemBlue
```

### Icon Colors

```swift
CometChatTheme.iconColorPrimary = UIColor.label
CometChatTheme.iconColorSecondary = UIColor.secondaryLabel
CometChatTheme.iconColorTertiary = UIColor.tertiaryLabel
CometChatTheme.iconColorWhite = UIColor.white
CometChatTheme.iconColorHighlight = UIColor.systemBlue
```

### Border Colors

```swift
CometChatTheme.borderColorDefault = UIColor.separator
CometChatTheme.borderColorLight = UIColor.separator.withAlphaComponent(0.5)
CometChatTheme.borderColorDark = UIColor.opaqueSeparator
CometChatTheme.borderColorHighlight = UIColor.systemBlue
```

### Status Colors

```swift
CometChatTheme.successColor = UIColor.systemGreen
CometChatTheme.warningColor = UIColor.systemOrange
CometChatTheme.errorColor = UIColor.systemRed
CometChatTheme.infoColor = UIColor.systemBlue
```

### Neutral Colors (50-900 scale)

```swift
CometChatTheme.neutralColor50 = UIColor.systemGray6
CometChatTheme.neutralColor100 = UIColor.systemGray5
CometChatTheme.neutralColor200 = UIColor.systemGray4
CometChatTheme.neutralColor300 = UIColor.systemGray3
CometChatTheme.neutralColor400 = UIColor.systemGray2
CometChatTheme.neutralColor500 = UIColor.systemGray
CometChatTheme.neutralColor600 = UIColor.darkGray
CometChatTheme.neutralColor700 = UIColor.gray
CometChatTheme.neutralColor800 = UIColor.lightGray
CometChatTheme.neutralColor900 = UIColor.black
```

---

## 2. Typography

### Font Configuration

```swift
import CometChatUIKitSwift

// Set custom font family — class func, NOT a settable property
CometChatTypography.setFont(name: "Avenir")

// Or customize individual text styles
CometChatTypography.Heading1.bold = UIFont.systemFont(ofSize: 28, weight: .bold)
CometChatTypography.Heading2.bold = UIFont.systemFont(ofSize: 24, weight: .bold)
CometChatTypography.Heading3.bold = UIFont.systemFont(ofSize: 20, weight: .bold)
CometChatTypography.Heading4.medium = UIFont.systemFont(ofSize: 18, weight: .medium)

CometChatTypography.Body.regular = UIFont.systemFont(ofSize: 16, weight: .regular)
CometChatTypography.Body.medium = UIFont.systemFont(ofSize: 16, weight: .medium)
CometChatTypography.Body.bold = UIFont.systemFont(ofSize: 16, weight: .bold)

CometChatTypography.Caption1.regular = UIFont.systemFont(ofSize: 14, weight: .regular)
CometChatTypography.Caption1.medium = UIFont.systemFont(ofSize: 14, weight: .medium)

CometChatTypography.Caption2.regular = UIFont.systemFont(ofSize: 12, weight: .regular)
CometChatTypography.Caption2.medium = UIFont.systemFont(ofSize: 12, weight: .medium)
```

### Using Custom Fonts

```swift
// Register custom fonts in Info.plist first under "Fonts provided by application"
// Then set them in CometChatTypography

CometChatTypography.Heading1.bold = UIFont(name: "CustomFont-Bold", size: 28) ?? .systemFont(ofSize: 28, weight: .bold)
CometChatTypography.Body.regular = UIFont(name: "CustomFont-Regular", size: 16) ?? .systemFont(ofSize: 16, weight: .regular)
```

---

## 3. Spacing

CometChat uses nested classes for spacing configuration.

### Spacing Configuration

```swift
import CometChatUIKitSwift

// Configure spacing scale (s = base, s1-s20 = increments)
CometChatSpacing.Spacing.s = 2    // Base spacing
CometChatSpacing.Spacing.s1 = 4
CometChatSpacing.Spacing.s2 = 8
CometChatSpacing.Spacing.s3 = 12
CometChatSpacing.Spacing.s4 = 16
CometChatSpacing.Spacing.s5 = 20
CometChatSpacing.Spacing.s6 = 24
CometChatSpacing.Spacing.s7 = 28
CometChatSpacing.Spacing.s8 = 32
CometChatSpacing.Spacing.s9 = 36
CometChatSpacing.Spacing.s10 = 40

// Padding (p = base, p1-p10 = increments)
CometChatSpacing.Padding.p = 2
CometChatSpacing.Padding.p1 = 4
CometChatSpacing.Padding.p2 = 8
CometChatSpacing.Padding.p3 = 12
CometChatSpacing.Padding.p4 = 16
CometChatSpacing.Padding.p5 = 20
CometChatSpacing.Padding.p6 = 24

// Radius (r = base, r1-r6 = increments, rMax = fully rounded)
CometChatSpacing.Radius.r = 2
CometChatSpacing.Radius.r1 = 4
CometChatSpacing.Radius.r2 = 8
CometChatSpacing.Radius.r3 = 12
CometChatSpacing.Radius.r4 = 16
CometChatSpacing.Radius.r5 = 20
CometChatSpacing.Radius.r6 = 24
CometChatSpacing.Radius.rMax = 1000  // Fully rounded

// Margin (m = base, m1-m20 = increments)
CometChatSpacing.Margin.m = 2
CometChatSpacing.Margin.m1 = 4
CometChatSpacing.Margin.m2 = 8
CometChatSpacing.Margin.m3 = 12
CometChatSpacing.Margin.m4 = 16
```

### Using Spacing Values

```swift
// Use spacing values in your layouts
let padding = CometChatSpacing.Padding.p3  // 12 points
let cornerRadius = CometChatSpacing.Radius.r2  // 8 points

// Use in CometChatCornerStyle
let style = CometChatCornerStyle(cornerRadius: CometChatSpacing.Radius.r2)
```

---

## 4. Component-Level Styling

Each CometChat component has a static `style` property. Modify these to customize appearance globally.

### CometChatConversations Style

```swift
// ConversationsStyle properties
CometChatConversations.style.backgroundColor = .systemBackground
CometChatConversations.style.borderWidth = 0
CometChatConversations.style.borderColor = .clear
CometChatConversations.style.cornerRadius = CometChatCornerStyle(cornerRadius: 0)

// Title styling
CometChatConversations.style.titleFont = CometChatTypography.Heading4.medium
CometChatConversations.style.titleColor = CometChatTheme.textColorPrimary
CometChatConversations.style.largeTitleFont = CometChatTypography.Heading1.bold
CometChatConversations.style.largeTitleColor = CometChatTheme.textColorPrimary

// List item styling
CometChatConversations.style.listItemTitleTextColor = CometChatTheme.textColorPrimary
CometChatConversations.style.listItemTitleFont = CometChatTypography.Heading4.medium
CometChatConversations.style.listItemSubTitleTextColor = CometChatTheme.textColorSecondary
CometChatConversations.style.listItemSubTitleFont = CometChatTypography.Body.regular
CometChatConversations.style.listItemBackground = .clear
CometChatConversations.style.listItemSelectedBackground = CometChatTheme.backgroundColor04

// Empty state styling
CometChatConversations.style.emptyTitleTextFont = CometChatTypography.Heading3.bold
CometChatConversations.style.emptyTitleTextColor = CometChatTheme.textColorPrimary
CometChatConversations.style.emptySubTitleFont = CometChatTypography.Body.regular
CometChatConversations.style.emptySubTitleTextColor = CometChatTheme.textColorSecondary

// Error state styling
CometChatConversations.style.errorTitleTextFont = CometChatTypography.Heading3.bold
CometChatConversations.style.errorTitleTextColor = CometChatTheme.textColorPrimary
CometChatConversations.style.errorSubTitleFont = CometChatTypography.Body.regular
CometChatConversations.style.errorSubTitleTextColor = CometChatTheme.textColorSecondary

// Retry button styling
CometChatConversations.style.retryButtonTextColor = CometChatTheme.buttonTextColor
CometChatConversations.style.retryButtonTextFont = CometChatTypography.Button.medium
CometChatConversations.style.retryButtonBackgroundColor = CometChatTheme.primaryColor

// Group type icons
CometChatConversations.style.privateGroupImageTintColor = CometChatTheme.backgroundColor01
CometChatConversations.style.privateGroupImageBackgroundColor = CometChatTheme.successColor
CometChatConversations.style.passwordGroupImageTintColor = CometChatTheme.backgroundColor01
CometChatConversations.style.passwordGroupImageBackgroundColor = CometChatTheme.warningColor

// Message type icon
CometChatConversations.style.messageTypeImageTint = CometChatTheme.iconColorSecondary
```

### CometChatMessageList Style

```swift
// MessageListStyle properties
CometChatMessageList.style.backgroundColor = CometChatTheme.backgroundColor02
CometChatMessageList.style.borderWidth = 0
CometChatMessageList.style.borderColor = .clear

// Shimmer loading colors
CometChatMessageList.style.shimmerGradientColor1 = CometChatTheme.backgroundColor04
CometChatMessageList.style.shimmerGradientColor2 = CometChatTheme.backgroundColor03

// Empty state styling
CometChatMessageList.style.emptyStateTitleColor = CometChatTheme.textColorPrimary
CometChatMessageList.style.emptyStateTitleFont = CometChatTypography.Heading3.bold
CometChatMessageList.style.emptyStateSubtitleColor = CometChatTheme.textColorSecondary
CometChatMessageList.style.emptyStateSubtitleFont = CometChatTypography.Body.regular

// Error state styling
CometChatMessageList.style.errorStateTitleColor = CometChatTheme.textColorPrimary
CometChatMessageList.style.errorStateTitleFont = CometChatTypography.Heading3.bold
CometChatMessageList.style.errorStateSubtitleColor = CometChatTheme.textColorSecondary
CometChatMessageList.style.errorStateSubtitleFont = CometChatTypography.Body.regular

// New message indicator
CometChatMessageList.style.newMessageIndicatorTextColor = CometChatTheme.errorColor
CometChatMessageList.style.newMessageIndicatorBackgroundColor = CometChatTheme.errorColor
CometChatMessageList.style.newMessageIndicatorTextFont = CometChatTypography.Caption1.medium

// Background image (optional)
CometChatMessageList.style.backgroundImage = UIImage(named: "chat-background")
```

### CometChatMessageBubble Style

Message bubbles use separate styles for incoming and outgoing messages:

```swift
// OUTGOING message bubble (sent by current user)
CometChatMessageBubble.style.outgoing.backgroundColor = CometChatTheme.primaryColor
CometChatMessageBubble.style.outgoing.borderWidth = 0
CometChatMessageBubble.style.outgoing.borderColor = .clear
CometChatMessageBubble.style.outgoing.cornerRadius = CometChatCornerStyle(cornerRadius: 16)
CometChatMessageBubble.style.outgoing.headerTextColor = CometChatTheme.primaryColor
CometChatMessageBubble.style.outgoing.headerTextFont = CometChatTypography.Caption1.medium

// INCOMING message bubble (received from others)
CometChatMessageBubble.style.incoming.backgroundColor = CometChatTheme.neutralColor300
CometChatMessageBubble.style.incoming.borderWidth = 0
CometChatMessageBubble.style.incoming.borderColor = .clear
CometChatMessageBubble.style.incoming.cornerRadius = CometChatCornerStyle(cornerRadius: 16)
CometChatMessageBubble.style.incoming.headerTextColor = CometChatTheme.primaryColor
CometChatMessageBubble.style.incoming.headerTextFont = CometChatTypography.Caption1.medium

// Text bubble styling within message bubbles
CometChatMessageBubble.style.outgoing.textBubbleStyle.textColor = .white
CometChatMessageBubble.style.outgoing.textBubbleStyle.textFont = CometChatTypography.Body.regular

CometChatMessageBubble.style.incoming.textBubbleStyle.textColor = CometChatTheme.textColorPrimary
CometChatMessageBubble.style.incoming.textBubbleStyle.textFont = CometChatTypography.Body.regular
```

### CometChatMessageComposer Style

```swift
// MessageComposerStyle properties
CometChatMessageComposer.style.backgroundColor = CometChatTheme.backgroundColor03
CometChatMessageComposer.style.borderWidth = 0
CometChatMessageComposer.style.borderColor = .clear

// Text input styling
CometChatMessageComposer.style.placeHolderTextFont = CometChatTypography.Body.regular
CometChatMessageComposer.style.placeHolderTextColor = CometChatTheme.textColorTertiary
CometChatMessageComposer.style.textFiledColor = CometChatTheme.textColorPrimary
CometChatMessageComposer.style.textFiledFont = CometChatTypography.Body.regular

// Compose box styling
CometChatMessageComposer.style.composeBoxBackgroundColor = CometChatTheme.backgroundColor01
CometChatMessageComposer.style.composeBoxBorderColor = CometChatTheme.borderColorDefault
CometChatMessageComposer.style.composeBoxBorderWidth = 1
CometChatMessageComposer.style.composerBoxCornerRadius = CometChatCornerStyle(cornerRadius: CometChatSpacing.Radius.r2)
CometChatMessageComposer.style.composerSeparatorColor = CometChatTheme.borderColorLight

// Send button styling
CometChatMessageComposer.style.sendButtonImageTint = CometChatTheme.white
CometChatMessageComposer.style.activeSendButtonImageBackgroundColor = CometChatTheme.primaryColor
CometChatMessageComposer.style.inactiveSendButtonImageBackgroundColor = CometChatTheme.neutralColor300

// Attachment button styling
CometChatMessageComposer.style.attachmentImageTint = CometChatTheme.iconColorSecondary

// Voice recording button styling
CometChatMessageComposer.style.voiceRecordingImageTint = CometChatTheme.iconColorSecondary

// AI button styling
CometChatMessageComposer.style.aiImageTint = CometChatTheme.iconColorSecondary

// Sticker button styling
CometChatMessageComposer.style.stickerTint = CometChatTheme.iconColorSecondary

// Edit preview styling
CometChatMessageComposer.style.editPreviewTitleTextFont = CometChatTypography.Body.regular
CometChatMessageComposer.style.editPreviewTitleTextColor = CometChatTheme.textColorPrimary
CometChatMessageComposer.style.editPreviewMessageTextFont = CometChatTypography.Caption1.regular
CometChatMessageComposer.style.editPreviewMessageTextColor = CometChatTheme.textColorSecondary
CometChatMessageComposer.style.editPreviewBackgroundColor = CometChatTheme.backgroundColor03
CometChatMessageComposer.style.editPreviewBorderColor = CometChatTheme.borderColorHighlight
CometChatMessageComposer.style.editPreviewCloseIconTint = CometChatTheme.iconColorHighlight
```

### CometChatAvatar Style

```swift
// AvatarStyle properties
CometChatAvatar.style.backgroundColor = CometChatTheme.extendedPrimaryColor500
CometChatAvatar.style.textColor = CometChatTheme.white
CometChatAvatar.style.textFont = CometChatTypography.Heading2.bold
CometChatAvatar.style.borderColor = .clear
CometChatAvatar.style.borderWidth = 0
CometChatAvatar.style.cornerRadius = nil // nil = circle by default
```

### CometChatBadge Style

```swift
// BadgeStyle properties
CometChatBadge.style.backgroundColor = CometChatTheme.primaryColor
CometChatBadge.style.textColor = CometChatTheme.buttonIconColor
CometChatBadge.style.textFont = CometChatTypography.Caption1.regular
CometChatBadge.style.cornerRadius = nil // nil = pill shape by default
CometChatBadge.style.borderWidth = 0.5
CometChatBadge.style.borderColor = UIColor.clear.cgColor
```

### CometChatStatusIndicator Style

```swift
// StatusIndicatorStyle properties
CometChatStatusIndicator.style.backgroundColor = CometChatTheme.successColor
CometChatStatusIndicator.style.borderColor = CometChatTheme.backgroundColor01
CometChatStatusIndicator.style.borderWidth = 0
CometChatStatusIndicator.style.cornerRadius = nil // nil = circle by default
CometChatStatusIndicator.style.backgroundImage = nil
```

### CometChatDate Style

```swift
// DateStyle properties
CometChatDate.style.textColor = CometChatTheme.textColorPrimary
CometChatDate.style.textFont = CometChatTypography.Caption1.medium
CometChatDate.style.backgroundColor = CometChatTheme.backgroundColor02
CometChatDate.style.borderWidth = 1
CometChatDate.style.borderColor = CometChatTheme.borderColorDark
CometChatDate.style.cornerRadius = nil
```

### CometChatReceipt Style

```swift
// ReceiptStyle properties
CometChatReceipt.style.waitImageTintColor = CometChatTheme.iconColorSecondary
CometChatReceipt.style.sentImageTintColor = CometChatTheme.iconColorSecondary
CometChatReceipt.style.deliveredImageTintColor = CometChatTheme.iconColorSecondary
CometChatReceipt.style.readImageTintColor = CometChatTheme.messageReadColor
CometChatReceipt.style.errorImageTintColor = CometChatTheme.iconColorSecondary

// Custom receipt images (optional)
CometChatReceipt.style.waitImage = UIImage(systemName: "clock")?.withRenderingMode(.alwaysTemplate) ?? UIImage()
CometChatReceipt.style.sentImage = UIImage(systemName: "checkmark")?.withRenderingMode(.alwaysTemplate) ?? UIImage()
CometChatReceipt.style.deliveredImage = UIImage(systemName: "checkmark.circle")?.withRenderingMode(.alwaysTemplate) ?? UIImage()
CometChatReceipt.style.readImage = UIImage(systemName: "checkmark.circle.fill")?.withRenderingMode(.alwaysTemplate) ?? UIImage()
```

---

## 5. Dark Mode Support

CometChat automatically supports dark mode when using system colors. For custom colors, use dynamic colors:

### Using Dynamic Colors

```swift
// Create a dynamic color that adapts to light/dark mode
let dynamicPrimary = UIColor { traitCollection in
    switch traitCollection.userInterfaceStyle {
    case .dark:
        return UIColor(red: 0.4, green: 0.6, blue: 1.0, alpha: 1.0)
    default:
        return UIColor(red: 0.0, green: 0.4, blue: 0.8, alpha: 1.0)
    }
}

CometChatTheme.primaryColor = dynamicPrimary
```

### Using Asset Catalog Colors

1. Create a Color Set in your asset catalog
2. Configure appearances for Any, Light, and Dark
3. Reference in code:

```swift
CometChatTheme.primaryColor = UIColor(named: "BrandPrimary") ?? .systemBlue
CometChatTheme.backgroundColor01 = UIColor(named: "Background") ?? .systemBackground
```

### Complete Theme Configuration Function

```swift
func configureCometChatTheme() {
    // Primary color with dark mode support
    CometChatTheme.primaryColor = UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0.35, green: 0.55, blue: 0.93, alpha: 1.0)
            : UIColor(red: 0.2, green: 0.4, blue: 0.8, alpha: 1.0)
    }
    
    // Backgrounds
    CometChatTheme.backgroundColor01 = UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0.11, green: 0.11, blue: 0.12, alpha: 1.0)
            : UIColor.white
    }
    
    CometChatTheme.backgroundColor02 = UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0.17, green: 0.17, blue: 0.18, alpha: 1.0)
            : UIColor(red: 0.95, green: 0.95, blue: 0.97, alpha: 1.0)
    }
    
    // Text colors
    CometChatTheme.textColorPrimary = UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor.white
            : UIColor.black
    }
    
    CometChatTheme.textColorSecondary = UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0.56, green: 0.56, blue: 0.58, alpha: 1.0)
            : UIColor(red: 0.42, green: 0.42, blue: 0.45, alpha: 1.0)
    }
}
```

---

## 6. Preset Theme Examples

### WhatsApp-like Theme

```swift
func applyWhatsAppTheme() {
    // Primary green
    CometChatTheme.primaryColor = UIColor(red: 0.15, green: 0.83, blue: 0.4, alpha: 1.0)
    
    // Backgrounds
    CometChatTheme.backgroundColor01 = UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0.07, green: 0.11, blue: 0.13, alpha: 1.0)
            : UIColor.white
    }
    
    CometChatTheme.backgroundColor02 = UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0.12, green: 0.17, blue: 0.2, alpha: 1.0)
            : UIColor(red: 0.94, green: 0.95, blue: 0.96, alpha: 1.0)
    }
    
    // Outgoing message bubble (green)
    CometChatMessageBubble.style.outgoing.backgroundColor = UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0.0, green: 0.36, blue: 0.29, alpha: 1.0)
            : UIColor(red: 0.86, green: 0.97, blue: 0.78, alpha: 1.0)
    }
    
    CometChatMessageBubble.style.outgoing.textBubbleStyle.textColor = UIColor { trait in
        trait.userInterfaceStyle == .dark ? .white : .black
    }
    
    // Incoming message bubble
    CometChatMessageBubble.style.incoming.backgroundColor = UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0.12, green: 0.17, blue: 0.2, alpha: 1.0)
            : UIColor.white
    }
}
```

### iMessage-like Theme

```swift
func applyiMessageTheme() {
    // Blue primary
    CometChatTheme.primaryColor = UIColor(red: 0.0, green: 0.48, blue: 1.0, alpha: 1.0)
    
    // Outgoing message bubble (blue)
    CometChatMessageBubble.style.outgoing.backgroundColor = UIColor(red: 0.0, green: 0.48, blue: 1.0, alpha: 1.0)
    CometChatMessageBubble.style.outgoing.textBubbleStyle.textColor = .white
    CometChatMessageBubble.style.outgoing.cornerRadius = CometChatCornerStyle(cornerRadius: 18)
    
    // Incoming message bubble (gray)
    CometChatMessageBubble.style.incoming.backgroundColor = UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0.23, green: 0.23, blue: 0.24, alpha: 1.0)
            : UIColor(red: 0.91, green: 0.91, blue: 0.92, alpha: 1.0)
    }
    CometChatMessageBubble.style.incoming.textBubbleStyle.textColor = UIColor { trait in
        trait.userInterfaceStyle == .dark ? .white : .black
    }
    CometChatMessageBubble.style.incoming.cornerRadius = CometChatCornerStyle(cornerRadius: 18)
}
```

---

## 7. Instance-Level Styling

For styling specific instances without affecting global styles:

```swift
// Create a conversations list with custom style
let conversations = CometChatConversations()

// Override style for this instance only
conversations.style.backgroundColor = UIColor.systemPink.withAlphaComponent(0.1)
conversations.style.listItemTitleTextColor = .systemPink

// Avatar style for this instance
conversations.avatarStyle.backgroundColor = UIColor.systemPink.withAlphaComponent(0.2)
```

---

## 8. Helper Extension

```swift
extension UIColor {
    convenience init(hex: String) {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")
        
        var rgb: UInt64 = 0
        Scanner(string: hexSanitized).scanHexInt64(&rgb)
        
        let r = CGFloat((rgb & 0xFF0000) >> 16) / 255.0
        let g = CGFloat((rgb & 0x00FF00) >> 8) / 255.0
        let b = CGFloat(rgb & 0x0000FF) / 255.0
        
        self.init(red: r, green: g, blue: b, alpha: 1.0)
    }
}
```

---

## Best Practices

1. **Configure theme early** — Set theme in `application(_:didFinishLaunchingWithOptions:)` before any CometChat UI is shown
2. **Use system colors** — They automatically adapt to dark mode
3. **Test both modes** — Always verify appearance in light and dark mode
4. **Use dynamic colors** — For custom colors that need to adapt to appearance changes
5. **Maintain contrast** — Ensure text is readable against backgrounds (WCAG guidelines)
6. **Be consistent** — Use the same color palette throughout your app
7. **Consider accessibility** — Support Dynamic Type by not hardcoding font sizes where possible
