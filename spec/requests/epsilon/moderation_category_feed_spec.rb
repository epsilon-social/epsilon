# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Epsilon : Moderation category feed filter' do
  describe 'GET /api/v1/timelines/public with category_ids' do
    subject do
      get '/api/v1/timelines/public', headers: headers, params: params
    end

    let(:user)    { Fabricate(:user, role: UserRole.find_by(name: 'Moderator')) }
    let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses') }
    let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

    let(:category)       { Fabricate(:epsilon_category_master) }
    let(:other_category) { Fabricate(:epsilon_category_master, name: 'Culture') }

    let!(:categorized_status)        { Fabricate(:status) }
    let!(:doubly_categorized_status) { Fabricate(:status) }
    let!(:invalidated_status)        { Fabricate(:status) }
    let!(:uncategorized_status)      { Fabricate(:status) }

    let(:params) { { category_ids: [category.id, other_category.id] } }

    before do
      Fabricate(:epsilon_local_post_categorization, status: categorized_status, category_master: category)
      Fabricate(:epsilon_local_post_categorization, status: doubly_categorized_status, category_master: category)
      Fabricate(:epsilon_local_post_categorization, status: doubly_categorized_status, category_master: other_category)
      Fabricate(:epsilon_local_post_categorization, status: invalidated_status, category_master: category, is_validated: false)
    end

    context 'when the user is a moderator' do
      it 'returns only validated posts of the selected categories, without duplicates', :aggregate_failures do
        subject

        expect(response).to have_http_status(200)
        expect(response.parsed_body.pluck(:id)).to match_array([categorized_status, doubly_categorized_status].map { |status| status.id.to_s })
      end

      it 'carries the filter over into the pagination links' do
        get '/api/v1/timelines/public', headers: headers, params: params.merge(limit: 1)

        expect(response.headers['Link']).to include('category_ids')
      end

      context 'with a single category' do
        let(:params) { { category_ids: [other_category.id] } }

        it 'returns only the posts of that category' do
          subject

          expect(response.parsed_body.pluck(:id)).to eq([doubly_categorized_status.id.to_s])
        end
      end
    end

    context 'when the user is not a moderator' do
      let(:user) { Fabricate(:user) }

      it 'ignores the filter and returns the unfiltered feed', :aggregate_failures do
        subject

        expect(response).to have_http_status(200)
        expect(response.parsed_body.pluck(:id))
          .to match_array([categorized_status, doubly_categorized_status, invalidated_status, uncategorized_status].map { |status| status.id.to_s })
      end

      it 'does not leak the filter into pagination links' do
        get '/api/v1/timelines/public', headers: headers, params: params.merge(limit: 1)

        expect(response.headers['Link']).to_not include('category_ids')
      end
    end

    context 'when the request is anonymous (crafted link, no token)' do
      let(:headers) { {} }

      it 'ignores the filter and returns the unfiltered feed', :aggregate_failures do
        subject

        expect(response).to have_http_status(200)
        expect(response.parsed_body.pluck(:id))
          .to match_array([categorized_status, doubly_categorized_status, invalidated_status, uncategorized_status].map { |status| status.id.to_s })
      end
    end

    context 'with hostile input from a moderator token' do
      it 'drops SQL-injection strings instead of erroring or filtering', :aggregate_failures do
        get '/api/v1/timelines/public', headers: headers, params: { category_ids: ['1; DROP TABLE statuses--', "' OR '1'='1"] }

        expect(response).to have_http_status(200)
        expect(response.parsed_body.pluck(:id))
          .to match_array([categorized_status, doubly_categorized_status, invalidated_status, uncategorized_status].map { |status| status.id.to_s })
      end

      it 'keeps only the coercible ids when garbage is mixed in' do
        get '/api/v1/timelines/public', headers: headers, params: { category_ids: [category.id.to_s, '1)); DELETE FROM statuses--'] }

        expect(response.parsed_body.pluck(:id)).to match_array([categorized_status, doubly_categorized_status].map { |status| status.id.to_s })
      end

      it 'accepts a scalar instead of an array' do
        get '/api/v1/timelines/public', headers: headers, params: { category_ids: other_category.id.to_s }

        expect(response.parsed_body.pluck(:id)).to eq([doubly_categorized_status.id.to_s])
      end

      it 'survives a nested-hash param without erroring', :aggregate_failures do
        get '/api/v1/timelines/public', headers: headers, params: { category_ids: { a: '1' } }

        expect(response).to have_http_status(200)
      end

      it 'caps the number of ids (an oversized list cannot smuggle ids past the cap)', :aggregate_failures do
        overflow = (1..60).map { |i| (category.id + 10_000 + i).to_s }
        get '/api/v1/timelines/public', headers: headers, params: { category_ids: overflow + [category.id.to_s] }

        expect(response).to have_http_status(200)
        expect(response.parsed_body).to be_empty
      end
    end
  end
end
