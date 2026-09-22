# frozen_string_literal: true

# Localized placeholders for the date-of-birth triple input.
#
# Core's DateOfBirthInput hardcodes DD / MM / YYYY in its OPTIONS constant, so
# the placeholders stay English even on a fully translated page. We keep every
# bit of core's behaviour (field order, ids, aria-labels, value parsing,
# validation) and only swap the visible placeholder for a localized one read
# from simple_form.placeholders.user.date_of_birth_{1i,2i,3i}, falling back to
# core's hardcoded value when a locale has no override.
#
# Prepended onto DateOfBirthInput from config/initializers/epsilon/extensions.rb.
# The body mirrors core's #input; only the added `placeholder:` line differs.
module Epsilon::DateOfBirthInputExtension
  def input(wrapper_options = nil)
    merged_input_options = merge_wrapper_options(input_html_options, wrapper_options)
    merged_input_options[:inputmode] = 'numeric'

    safe_join(
      ordered_options.map do |option|
        options = merged_input_options
          .merge(DateOfBirthInput::OPTIONS[option])
          .merge(
            id: generate_id(option),
            'aria-label': I18n.t("simple_form.labels.user.date_of_birth_#{param_for(option)}"),
            placeholder: epsilon_localized_placeholder(option),
            value: values[option]
          )
        @builder.text_field("#{attribute_name}(#{param_for(option)})", options)
      end
    )
  end

  private

  def epsilon_localized_placeholder(option)
    I18n.t(
      "simple_form.placeholders.user.date_of_birth_#{param_for(option)}",
      default: DateOfBirthInput::OPTIONS[option][:placeholder]
    )
  end
end
