# frozen_string_literal: true

require 'rails_helper'

# A draft curated feed is a staff-only work-in-progress: it must be invisible
# to everyone else, and a leaked slug must behave exactly like an unknown one
# (same 404, no enumeration oracle).
RSpec.describe 'Epsilon : Curated feeds draft access' do
  let(:published_feed) { Epsilon::Curation::CuratedFeed.create!(name: 'Discover', slug: 'discover', state: :published) }
  let(:draft_feed)     { Epsilon::Curation::CuratedFeed.create!(name: 'Secret event', slug: 'secret-event', state: :draft) }
  let(:draft_status)   { Fabricate(:status) }

  before do
    published_feed.add_published!(Fabricate(:status))
    draft_feed.add_published!(draft_status)
  end

  shared_examples 'draft feed is invisible' do
    it 'omits the draft feed from the feeds index' do
      get '/api/v1/epsilon/curated_feeds', headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body.pluck(:slug)).to contain_exactly('discover')
    end

    it 'returns the same 404 for the draft slug as for an unknown slug' do
      get '/api/v1/epsilon/curated_feeds/secret-event/statuses', headers: headers
      expect(response).to have_http_status(404)
      draft_body = response.body

      get '/api/v1/epsilon/curated_feeds/does-not-exist/statuses', headers: headers
      expect(response).to have_http_status(404)
      expect(draft_body).to eq(response.body)
    end
  end

  context 'when anonymous' do
    let(:headers) { {} }

    it_behaves_like 'draft feed is invisible'
  end

  context 'with a regular user' do
    let(:user)    { Fabricate(:user) }
    let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses') }
    let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

    it_behaves_like 'draft feed is invisible'
  end

  context 'with staff lacking the taxonomies permission' do
    let(:role)    { Fabricate(:user_role, permissions: UserRole::FLAGS[:manage_reports]) }
    let(:user)    { Fabricate(:user, role: role) }
    let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses') }
    let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

    it_behaves_like 'draft feed is invisible'
  end

  # In this fork the Moderator preset includes manage_taxonomies — moderators
  # are curators.
  context 'with a moderator' do
    let(:user)    { Fabricate(:moderator_user) }
    let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses') }
    let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

    it 'lists the draft feed' do
      get '/api/v1/epsilon/curated_feeds', headers: headers

      expect(response.parsed_body.pluck(:slug)).to contain_exactly('discover', 'secret-event')
    end
  end

  context 'with a staff curator (manage_taxonomies)' do
    let(:user)    { Fabricate(:admin_user) }
    let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses') }
    let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

    it 'lists the draft feed with its state', :aggregate_failures do
      get '/api/v1/epsilon/curated_feeds', headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body.pluck(:slug)).to contain_exactly('discover', 'secret-event')

      draft_payload = response.parsed_body.find { |feed| feed[:slug] == 'secret-event' }
      expect(draft_payload[:state]).to eq('draft')
    end

    it 'serves the published items of the draft feed (preview)', :aggregate_failures do
      get '/api/v1/epsilon/curated_feeds/secret-event/statuses', headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body.pluck(:id)).to contain_exactly(draft_status.id.to_s)
    end
  end
end
